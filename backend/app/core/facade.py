from sqlalchemy.orm import Session
import numpy as np
from datetime import datetime

from app.schemas.requests import CheckoutSlotRequest, CheckoutSlotResponse
from app.db.repositories import SQLRiderRepository, SQLSlotDemandRepository
from app.core.strategy import get_capacity_strategy, WeatherCondition
from app.core.ml_manager import MLManager
from app.db.models import SlotDemand


class SlotAvailabilityFacade:
    def __init__(self, db: Session):
        self.db = db
        self.rider_repo = SQLRiderRepository(db)
        self.demand_repo = SQLSlotDemandRepository(db)
        self.ml_manager = MLManager()  # Safely grabs the exact same Singleton instance

    def _map_weather_to_ml_float(self, weather: WeatherCondition) -> float:
        mapping = {
            WeatherCondition.CLEAR: 1.0,
            WeatherCondition.WINDY: 1.2,
            WeatherCondition.RAIN: 1.5,
            WeatherCondition.STORM: 1.8
        }
        return mapping.get(weather, 1.0)

    def _map_traffic_to_ml_float(self, traffic: str) -> float:
        mapping = {
            "LOW": 1.0,
            "MEDIUM": 1.2,
            "HIGH": 1.5,
            "GRIDLOCK": 2.0
        }
        return mapping.get(traffic, 1.0)

    async def evaluate_slot(self, request: CheckoutSlotRequest) -> CheckoutSlotResponse:
        # 1. Fetch Real-World Data from Repositories (now scoped to run_id)
        active_riders = self.rider_repo.get_active_riders(request.zone_id, request.run_id)
        current_load = self.demand_repo.get_current_load(request.zone_id, request.slot_time, request.run_id)

        # 2. Execute Business Math (Strategy Pattern)
        strategy = get_capacity_strategy(request.weather, request.is_festival)
        max_capacity = strategy.calculate_capacity(active_riders)

        # 3. Prepare the precise Feature Matrix for XGBoost
        target_hour = request.slot_time.hour
        is_weekend = 1 if request.slot_time.weekday() >= 5 else 0

        ml_features = {
            "zone_id": request.zone_id,
            "Weather": self._map_weather_to_ml_float(request.weather),
            "Traffic": self._map_traffic_to_ml_float(request.traffic),
            "Is_Weekend": is_weekend,
            "Is_Festival": 1 if request.is_festival else 0,
            "Current_Load": current_load,
            "Hour_Sin": np.sin(2 * np.pi * target_hour / 24),
            "Hour_Cos": np.cos(2 * np.pi * target_hour / 24)
        }

        # 4. Offload the heavy XGBoost math to the Thread Pool
        predicted_demand = await self.ml_manager.predict_async(ml_features)

        # 5. Check if surge pricing is active for this slot
        date_str = request.slot_time.strftime("%Y-%m-%d")
        slot_record = self.db.query(SlotDemand).filter(
            SlotDemand.run_id == request.run_id,
            SlotDemand.zone_id == request.zone_id,
            SlotDemand.date == date_str,
            SlotDemand.target_hour == request.slot_time.hour
        ).first()
        surge_active = slot_record.surge_fee_active if slot_record else False
        surge_amount = slot_record.surge_fee_amount if slot_record else 0.0

        # 6. The Ultimate Rule: Compare Demand vs Capacity
        is_available = predicted_demand <= max_capacity

        return CheckoutSlotResponse(
            zone_id=request.zone_id,
            slot_time=request.slot_time,
            is_available=is_available,
            predicted_demand=int(predicted_demand),
            live_capacity=max_capacity,
            surge_fee_active=surge_active,
            surge_fee_amount=surge_amount
        )
