from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import numpy as np

from app.db.database import get_db
from app.db.models import RiderState, SlotDemand
from app.core.ml_manager import MLManager
from app.core.strategy import SevereWeatherStrategy, StandardDayStrategy
from app.core.facade import SlotAvailabilityFacade

router = APIRouter()
ZONES = [1, 2, 3, 4, 5, 6, 7, 8]


@router.get("/status")
def get_zone_status(run_id: str, db: Session = Depends(get_db)):
    """
    Called by the Admin Dashboard on mount to get live rider count
    and current order load per zone for the active simulation.
    """
    result = []
    for z in ZONES:
        riders_online = db.query(RiderState).filter(
            RiderState.run_id == run_id,
            RiderState.current_zone_id == z,
            RiderState.status == "ONLINE"
        ).count()

        load_record = db.query(SlotDemand).filter(
            SlotDemand.run_id == run_id,
            SlotDemand.zone_id == z
        ).order_by(SlotDemand.target_hour.asc()).first()

        result.append({
            "zone_id": z,
            "active_riders": riders_online,
            "current_load": load_record.current_load if load_record else 0,
        })

    return result


@router.get("/demand-forecast")
async def get_demand_forecast(
    run_id: str,
    target_time: datetime,
    weather: str,
    traffic: str,
    is_festival: bool,
    db: Session = Depends(get_db)
):
    """
    Runs the XGBoost model 32 times (8 zones x 4 hours) to generate the Admin Dashboard Chart.
    Applies context-aware advance-booking decay so future slots realistically taper off.
    """
    facade = SlotAvailabilityFacade(db)
    
    # Decide Strategy based on UI Weather
    if weather in ["RAIN", "STORM"]:
        strategy = SevereWeatherStrategy()
    else:
        strategy = StandardDayStrategy()
        
    ml_manager = MLManager()
    forecast_results = []

    for zone_id in ZONES:
        # 1. Fetch current active riders for capacity
        riders_count = db.query(RiderState).filter(
            RiderState.run_id == run_id,
            RiderState.current_zone_id == zone_id,
            RiderState.status == "ONLINE"
        ).count()
        
        max_capacity = strategy.calculate_capacity(riders_count)

        zone_data = {
            "zone_id": zone_id,
            "zone_name": f"Zone {zone_id}",
            "capacity": max_capacity,
            "active_riders": riders_count,
            "hours": []
        }

        # 2. Loop through the next 4 hours and predict
        for i in range(4):
            # Use timedelta to correctly wrap around midnight (0-23 hours, next day date)
            future_time = target_time + timedelta(hours=i)
            target_hour = future_time.hour
            is_weekend = 1 if future_time.weekday() >= 5 else 0
            
            # Fetch the actual committed load we injected during /initialize
            date_str = future_time.strftime("%Y-%m-%d")
            load_record = db.query(SlotDemand).filter(
                SlotDemand.run_id == run_id,
                SlotDemand.zone_id == zone_id,
                SlotDemand.date == date_str,
                SlotDemand.target_hour == target_hour
            ).first()
            
            current_load = load_record.current_load if load_record else 0

            # Prepare Features for XGBoost
            from app.core.strategy import WeatherCondition
            ml_features = {
                "zone_id": zone_id,
                "Weather": facade._map_weather_to_ml_float(WeatherCondition(weather)),
                "Traffic": facade._map_traffic_to_ml_float(traffic),
                "Is_Weekend": is_weekend,
                "Is_Festival": 1 if is_festival else 0,
                "Current_Load": current_load,
                "Hour_Sin": np.sin(2 * np.pi * target_hour / 24),
                "Hour_Cos": np.cos(2 * np.pi * target_hour / 24)
            }

            # Await the XGBoost Threadpool
            predicted_demand = await ml_manager.predict_async(ml_features)
            predicted_demand = int(predicted_demand)
            
            # UI Business Logic
            status = "SAFE"
            if predicted_demand > max_capacity:
                status = "LOCKED"
            elif predicted_demand > (max_capacity * 0.8):
                status = "RISK"

            # ML Binary Search Solver for exact true headroom and true excess
            true_headroom = 0
            true_excess = 0
            
            if predicted_demand < max_capacity:
                low = 0
                high = max_capacity
                best = 0
                
                while low <= high:
                    mid = (low + high) // 2
                    test_features = ml_features.copy()
                    test_features["Current_Load"] = mid
                    
                    test_pred = await ml_manager.predict_async(test_features)
                    
                    if test_pred <= max_capacity:
                        best = mid
                        low = mid + 1 
                    else:
                        high = mid - 1 
                        
                true_headroom = max(0, best - current_load)
            else:
                low = 0
                high = current_load
                best_allowed_load = 0
                
                while low <= high:
                    mid = (low + high) // 2
                    test_features = ml_features.copy()
                    test_features["Current_Load"] = mid
                    
                    test_pred = await ml_manager.predict_async(test_features)
                    
                    if test_pred <= max_capacity:
                        best_allowed_load = mid
                        low = mid + 1 
                    else:
                        high = mid - 1 
                        
                true_excess = current_load - best_allowed_load

            zone_data["hours"].append({
                "hour": target_hour,
                "slot": f"{target_hour:02d}:00 - {(target_hour + 1) % 24:02d}:00",
                "predicted_demand": predicted_demand,
                "current_load": current_load,
                "status": status,
                "true_headroom": true_headroom,
                "true_excess": true_excess
            })

        forecast_results.append(zone_data)

    return {"forecast": forecast_results}

