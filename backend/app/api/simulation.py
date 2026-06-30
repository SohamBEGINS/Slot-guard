from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import uuid
import random

from app.db.database import get_db
from app.db.models import SimulationRun, Rider, RiderState, Order, SlotDemand
from app.schemas.requests import SimulationInitRequest
from app.core.dataset_manager import DatasetManager
from app.core.ml_manager import MLManager

router = APIRouter()
ZONES = [1, 2, 3, 4, 5, 6, 7, 8]


@router.post("/initialize")
def initialize_simulation(req: SimulationInitRequest, db: Session = Depends(get_db)):
    """
    Sets up a fresh simulation run in the database.
    1. Creates a new run_id.
    2. Brings a percentage of the permanent workforce ONLINE.
    3. Injects historically accurate starting load per zone for the next 4 hours.
    """
    # 1. Create the Simulation Run
    run_id = str(uuid.uuid4())
    sim_run = SimulationRun(
        run_id=run_id,
        run_name=req.run_name,
        config=req.model_dump()
    )
    db.add(sim_run)

    # 2. Deploy Riders based on percentage
    permanent_riders = db.query(Rider).all()
    if not permanent_riders:
        raise HTTPException(status_code=500, detail="Database not seeded! Restart server.")

    # Group riders by zone
    zone_riders = {z: [] for z in ZONES}
    for r in permanent_riders:
        zone_riders[r.home_zone_id].append(r)

    total_online = 0
    for z, riders_in_zone in zone_riders.items():
        online_count = int(len(riders_in_zone) * req.fleet_deployment_pct)
        # Shuffle so it's not the exact same people every time
        random.shuffle(riders_in_zone)
        
        for i, r in enumerate(riders_in_zone):
            status = "ONLINE" if i < online_count else "INACTIVE"
            if status == "ONLINE": 
                total_online += 1
            
            db.add(RiderState(
                run_id=run_id,
                rider_id=r.rider_id,
                current_zone_id=z,
                status=status
            ))

    # 3. Inject Orders based on Dataset
    dataset_manager = DatasetManager()
    total_orders = 0
    
    # We simulate the current hour (t) and next 3 hours (t+1, t+2, t+3)
    for i in range(4):
        target_hour = req.target_time.hour + i
        slot_window = f"{target_hour}:00-{target_hour+1}:00"
        
        # Query dataset for committed load at this specific hour under these conditions
        zone_loads = dataset_manager.get_committed_load_per_zone(
            weather=req.weather,
            traffic=req.traffic,
            is_festival=req.is_festival,
            target_hour=target_hour
        )
        
        for z in ZONES:
            load = zone_loads[z]
            
            # Save the aggregated load row
            db.add(SlotDemand(
                run_id=run_id,
                date=req.target_time.strftime("%Y-%m-%d"),
                zone_id=z,
                target_hour=target_hour,
                slot_window=slot_window,
                current_load=load
            ))
            
            # Save the individual Order rows
            for _ in range(load):
                db.add(Order(
                    order_id=str(uuid.uuid4()),
                    run_id=run_id,
                    timestamp=req.target_time,
                    zone_id=z,
                    chosen_slot=slot_window,
                    status="Pending"
                ))
                total_orders += 1

    db.commit()

    return {
        "message": "Simulation Initialized",
        "run_id": run_id,
        "riders_online": total_online,
        "orders_injected": total_orders
    }
