import uuid
import random
from datetime import datetime, timedelta
import numpy as np
import asyncio
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import ActiveRider, SlotDemand, Region, Order
from app.schemas.requests import SimulationInitRequest
from app.core.ml_manager import MLManager
from app.core.facade import SlotAvailabilityFacade
from app.core.strategy import StandardDayStrategy, SevereWeatherStrategy

router = APIRouter()

ZONES = list(range(1, 9))  # Zones 1 through 8


@router.post("/initialize", status_code=200)
def initialize_simulation(req: SimulationInitRequest, db: Session = Depends(get_db)):
    """
    God-Mode endpoint. Called once from the SetupPage.
    1. Wipes all old simulation data.
    2. Seeds 8 Region rows if they don't exist.
    3. Distributes fleet_size riders across 8 zones → active_riders table.
    4. Injects initial_orders orders across 8 zones → orders table.
    5. Counts orders per zone → writes current_load to slot_demand table.
    """

    # 1. Wipe old simulation state
    db.query(Order).delete()
    db.query(ActiveRider).delete()
    db.query(SlotDemand).delete()
    db.flush()

    # 2. Ensure 8 Region rows exist (idempotent)
    for z in ZONES:
        exists = db.query(Region).filter(Region.zone_id == z).first()
        if not exists:
            db.add(Region(
                zone_id=z,
                zone_name=f"Zone {z}",
                base_fleet_capacity=25,
                manual_rider_adjustment=0
            ))
    db.flush()

    # 3. Distribute fleet evenly across zones
    riders_per_zone = req.fleet_size // len(ZONES)
    for z in ZONES:
        for _ in range(riders_per_zone):
            db.add(ActiveRider(
                rider_id=str(uuid.uuid4()),
                current_zone_id=z,
                status="ONLINE",
                last_ping=datetime.now()
            ))

    # 4. Inject initial_orders randomly across zones, track count per zone
    zone_order_counts = {z: 0 for z in ZONES}
    date_str = req.target_time.strftime("%Y-%m-%d")
    slot_window = f"{req.target_time.hour:02d}:00-{(req.target_time.hour + 1) % 24:02d}:00"

    for _ in range(req.initial_orders):
        z = random.choice(ZONES)
        zone_order_counts[z] += 1
        db.add(Order(
            order_id=str(uuid.uuid4()),
            timestamp=req.target_time,
            zone_id=z,
            chosen_slot=slot_window,
            status="Pending"
        ))

    # 5. Write per-zone order counts to slot_demand as current_load
    for z in ZONES:
        db.add(SlotDemand(
            date=date_str,
            zone_id=z,
            target_hour=req.target_time.hour,
            slot_window=slot_window,
            current_load=zone_order_counts[z]
        ))

    db.commit()

    return {
        "message": "Simulation Initialized Successfully",
        "zones_seeded": len(ZONES),
        "fleet_deployed": riders_per_zone * len(ZONES),
        "orders_injected": req.initial_orders,
        "load_per_zone": zone_order_counts
    }


@router.get("/zone-status")
def get_zone_status(db: Session = Depends(get_db)):
    """
    Called by the Admin Dashboard on mount to get live rider count
    and current order load per zone.
    """
    result = []
    for z in ZONES:
        riders = db.query(ActiveRider).filter(
            ActiveRider.current_zone_id == z,
            ActiveRider.status == "ONLINE"
        ).count()

        load_record = db.query(SlotDemand).filter(
            SlotDemand.zone_id == z
        ).order_by(SlotDemand.demand_id.desc()).first()

        result.append({
            "zone_id": z,
            "active_riders": riders,
            "current_load": load_record.current_load if load_record else 0,
        })

    return result

@router.get("/demand-forecast")
async def get_demand_forecast(
    target_time: datetime,
    weather: str,
    traffic: str,
    is_festival: bool,
    db: Session = Depends(get_db)
):
    """
    Runs the XGBoost model 48 times (8 zones x 6 hours) to generate the Admin Dashboard Chart.
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
        riders_count = db.query(ActiveRider).filter_by(current_zone_id=zone_id, status="ONLINE").count()
        max_capacity = strategy.calculate_capacity(riders_count)

        zone_data = {
            "zone_id": zone_id,
            "zone_name": f"Zone {zone_id}",
            "capacity": max_capacity,
            "active_riders": riders_count,
            "hours": []
        }

        # 2. Loop through the next 4 hours and predict
        # 4 hours is the sweet spot: meaningful trend without cramping the dashboard.
        for i in range(4):
            future_time = target_time + timedelta(hours=i)
            target_hour = future_time.hour
            is_weekend = 1 if future_time.weekday() >= 5 else 0
            
            # --- Context-Aware Slot Booking Decay Model ---
            # The decay_rate controls how steeply future slots empty out.
            # Normal weekday: steep decay (people want the immediate slot).
            # Festival: very slow decay (every slot fills up — people plan ahead aggressively).
            # Gridlock / Storm: moderate-slow decay (people hedge by booking later slots).
            # Weekend: slightly flatter than weekday (more planned grocery runs).
            base_load = db.query(Order).filter_by(zone_id=zone_id).count()

            decay_rate = 0.70  # Default: Normal weekday — steep drop-off

            if is_festival:
                decay_rate = 0.93   # Festival: nearly flat — all slots fill up
            elif traffic == "GRIDLOCK":
                decay_rate = max(decay_rate, 0.85)  # Gridlock: people book ahead to hedge
            elif weather in ["RAIN", "STORM"]:
                decay_rate = max(decay_rate, 0.82)  # Bad weather: moderate advance booking
            elif is_weekend == 1:
                decay_rate = max(decay_rate, 0.78)  # Weekend: slight forward planning

            decay_factor = decay_rate ** i
            current_load = int(base_load * decay_factor)

            from app.core.strategy import WeatherCondition
            # Prepare Features for XGBoost
            ml_features = {
                "zone_id": zone_id,
                "Hour_Sin": np.sin(2 * np.pi * target_hour / 24),
                "Hour_Cos": np.cos(2 * np.pi * target_hour / 24),
                "Is_Weekend": is_weekend,
                "Is_Festival": 1 if is_festival else 0,
                "Weather_Severity": facade._map_weather_to_ml_float(WeatherCondition(weather)),
                "Traffic_Encoded": facade._map_traffic_to_ml_float(traffic),
                "Current_Load": current_load
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

            zone_data["hours"].append({
                "hour": target_hour,
                "slot": f"{target_hour}:00 - {target_hour + 1}:00",
                "predicted_demand": predicted_demand,
                "current_load": current_load,
                "status": status
            })

        forecast_results.append(zone_data)

    return {"forecast": forecast_results}

class RebalanceRequest(BaseModel):
    source_zone: int
    target_zone: int
    rider_count: int

@router.post("/rebalance-riders")
def rebalance_riders(req: RebalanceRequest, db: Session = Depends(get_db)):
    """Moves active riders from one zone to another to alleviate congestion"""
    riders = db.query(ActiveRider).filter_by(current_zone_id=req.source_zone, status="ONLINE").limit(req.rider_count).all()
    
    if len(riders) < req.rider_count:
        raise HTTPException(status_code=400, detail="Not enough riders in source zone")
        
    for rider in riders:
        rider.current_zone_id = req.target_zone
        
    db.commit()
    return {"message": f"Successfully rebalanced {req.rider_count} riders"}

class IncentiveRequest(BaseModel):
    zone_id: int
    riders_to_add: int = 15

@router.post("/incentive")
def apply_rider_incentive(req: IncentiveRequest, db: Session = Depends(get_db)):
    """Simulates a Rider Bonus by permanently adding new active riders to the zone."""
    for _ in range(req.riders_to_add):
        db.add(ActiveRider(
            rider_id=str(uuid.uuid4()),
            current_zone_id=req.zone_id,
            status="ONLINE",
            last_ping=datetime.utcnow()
        ))
    db.commit()
    return {"message": f"Successfully onboarded {req.riders_to_add} riders to Zone {req.zone_id}"}

class SurgeRequest(BaseModel):
    zone_id: int
    drop_percentage: float = 0.15

@router.post("/surge-pricing")
def apply_surge_pricing(req: SurgeRequest, db: Session = Depends(get_db)):
    """Simulates Demand Suppression by dropping a percentage of pending orders."""
    orders = db.query(Order).filter_by(zone_id=req.zone_id, status="Pending").all()
    drop_count = int(len(orders) * req.drop_percentage)
    
    if drop_count > 0:
        orders_to_drop = random.sample(orders, drop_count)
        for o in orders_to_drop:
            db.delete(o)
        db.commit()
        
    return {"message": f"Dropped {drop_count} orders due to Surge Pricing in Zone {req.zone_id}"}
