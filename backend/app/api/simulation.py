import uuid
import random
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import ActiveRider, SlotDemand, Region, Order
from app.schemas.requests import SimulationInitRequest

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
