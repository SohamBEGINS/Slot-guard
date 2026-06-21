from sqlalchemy.orm import Session
import numpy as np
from datetime import datetime

from app.schemas.requests import CheckoutSlotRequest, CheckoutSlotResponse
from app.db.repositories import SQLRiderRepository, SQLSlotDemandRepository
from app.core.strategy import get_capacity_strategy, WeatherCondition
from app.core.ml_manager import MLManager

class SlotAvailabilityFacade:
    def __init__(self, db: Session):
        self.rider_repo = SQLRiderRepository(db)
        self.demand_repo = SQLSlotDemandRepository(db)
        self.ml_manager = MLManager() # Safely grabs the exact same Singleton instance
        
    def _map_weather_to_ml_float(self, weather: WeatherCondition) -> float:
        """
        Translates the pure Business Logic Enum into the precise float 
        required by the XGBoost training matrix.
        """
        mapping = {
            WeatherCondition.CLEAR: 1.0,
            WeatherCondition.WINDY: 1.2,
            WeatherCondition.RAIN: 1.5,
            WeatherCondition.STORM: 1.8
        }
        return mapping.get(weather, 1.0)

    async def evaluate_slot(self, request: CheckoutSlotRequest) -> CheckoutSlotResponse:
        # 1. Fetch Real-World Data from Repositories
        active_riders = self.rider_repo.get_active_riders(request.zone_id)
        current_load = self.demand_repo.get_current_load(request.zone_id, request.slot_time)
        
        # 2. Execute Business Math (Strategy Pattern)
        strategy = get_capacity_strategy(request.weather, request.is_festival)
        max_capacity = strategy.calculate_capacity(active_riders)
        
        # 3. Prepare the precise Feature Matrix for XGBoost
        target_hour = request.slot_time.hour
        is_weekend = 1 if request.slot_time.weekday() >= 5 else 0
        
        ml_features = {
            "zone_id": request.zone_id,
            "Hour_Sin": np.sin(2 * np.pi * target_hour / 24),
            "Hour_Cos": np.cos(2 * np.pi * target_hour / 24),
            "Is_Weekend": is_weekend,
            "Is_Festival": 1 if request.is_festival else 0,
            "Weather_Severity": self._map_weather_to_ml_float(request.weather),
            "Traffic_Encoded": 1.2, # Defaulting to Medium Traffic for the simulation
            "Current_Load": current_load
        }
        
        # 4. Offload the heavy XGBoost math to the Thread Pool
        predicted_demand = await self.ml_manager.predict_async(ml_features)
        
        # 5. The Ultimate Rule: Compare Demand vs Capacity
        is_available = predicted_demand <= max_capacity
        
        return CheckoutSlotResponse(
            zone_id=request.zone_id,
            slot_time=request.slot_time,
            is_available=is_available,
            predicted_demand=int(predicted_demand),
            live_capacity=max_capacity
        )
