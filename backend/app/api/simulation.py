from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import uuid
import random

from app.db.database import get_db
from app.db.models import SimulationRun, Rider, RiderState, Order, SlotDemand
from app.schemas.requests import SimulationInitRequest
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
        config=req.model_dump(mode="json"),
        created_by=req.created_by
    )
    db.add(sim_run)
    db.commit()

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

    # 3. Inject Orders based on Dataset with Context-Aware Decay
    # Advance slot booking patterns decay differently based on scenario:
    #   Normal weekday:  0.70^i → [100%, 70%, 49%, 34%] — clear drop-off
    #   Weekend:         0.78^i → [100%, 78%, 61%, 47%] — gentler, planned bookings
    #   Rain/Storm:      0.82^i → [100%, 82%, 67%, 55%] — people hedge, book later
    #   Gridlock:        0.85^i → [100%, 85%, 72%, 61%] — strong future booking
    #   Festival:        0.93^i → [100%, 93%, 86%, 80%] — nearly flat, everything fills!
    def get_decay_base(weather: str, traffic: str, is_festival: bool) -> float:
        if is_festival:
            return 0.93
        if traffic == "GRIDLOCK":
            return 0.85
        if weather in ["RAIN", "STORM"]:
            return 0.82
        if req.target_time.weekday() >= 5:  # Weekend
            return 0.78
        return 0.70  # Normal weekday

    decay_base = get_decay_base(req.weather, req.traffic, req.is_festival)
    total_orders = 0
    
    # 3. User Requested Logic: Take total injected orders and distribute randomly across 8 zones
    random_splits = [random.uniform(0.1, 1.0) for _ in ZONES]
    sum_splits = sum(random_splits)
    
    zone_base_loads = {}
    for z, split in zip(ZONES, random_splits):
        zone_base_loads[z] = int(req.total_orders_to_inject * (split / sum_splits))
        
    # We simulate the current hour (t) and next 3 hours (t+1, t+2, t+3)
    for i in range(4):
        future_time = req.target_time + timedelta(hours=i)
        target_hour = future_time.hour
        date_str = future_time.strftime("%Y-%m-%d")
        next_hour = (target_hour + 1) % 24
        slot_window = f"{target_hour:02d}:00-{next_hour:02d}:00"
        decay_factor = decay_base ** i
        
        for z in ZONES:
            raw_load = zone_base_loads[z]
            
            load = max(1, int(raw_load * decay_factor))  # Decay the load, keep min 1
            
            # Save the aggregated load row
            db.add(SlotDemand(
                run_id=run_id,
                date=date_str,
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

@router.get("/runs")
def get_simulation_runs(username: str, db: Session = Depends(get_db)):
    """
    Fetches all past simulation runs for a specific user.
    """
    runs = db.query(SimulationRun).filter(SimulationRun.created_by == username).order_by(SimulationRun.created_at.desc()).all()
    return {"runs": runs}

@router.delete("/{run_id}")
def delete_simulation(run_id: str, db: Session = Depends(get_db)):
    """
    Deletes a specific simulation run and all associated relational records (cascading manually).
    """
    sim_run = db.query(SimulationRun).filter(SimulationRun.run_id == run_id).first()
    if not sim_run:
        raise HTTPException(status_code=404, detail="Simulation not found")
        
    db.query(RiderState).filter(RiderState.run_id == run_id).delete()
    db.query(SlotDemand).filter(SlotDemand.run_id == run_id).delete()
    db.query(Order).filter(Order.run_id == run_id).delete()
    
    db.delete(sim_run)
    db.commit()
    
    return {"message": f"Deleted simulation {run_id} successfully"}
