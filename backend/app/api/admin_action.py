from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
import random

from app.db.database import get_db
from app.db.models import RiderState, Rider, Order, SlotDemand

router = APIRouter()
ZONES = [1, 2, 3, 4, 5, 6, 7, 8]


# ─── Rider Inspection (Admin UI before rebalancing) ───────────────────────────

@router.get("/riders")
def get_riders_in_zone(run_id: str, zone_id: int, status: str = "ONLINE", db: Session = Depends(get_db)):
    """
    Returns the full rider roster for a zone in a given simulation run.
    Admin inspects skill breakdown BEFORE deciding who to move.
    status param: 'ONLINE', 'INACTIVE', or 'ALL'
    """
    query = db.query(RiderState, Rider).join(
        Rider, RiderState.rider_id == Rider.rider_id
    ).filter(
        RiderState.run_id == run_id,
        RiderState.current_zone_id == zone_id,
    )

    if status != "ALL":
        query = query.filter(RiderState.status == status)

    results = query.all()

    return [
        {
            "rider_id": rider.rider_id,
            "name": rider.name,
            "phone": rider.phone,
            "skill_tier": rider.skill_tier,
            "status": state.status,
            "current_zone_id": state.current_zone_id,
        }
        for state, rider in results
    ]


# ─── Rebalance Riders ─────────────────────────────────────────────────────────

class RebalanceRequest(BaseModel):
    run_id: str
    source_zone: int
    target_zone: int
    rider_ids: List[str]  # Admin hand-picks specific riders after skill inspection


@router.post("/rebalance-riders")
def rebalance_riders(req: RebalanceRequest, db: Session = Depends(get_db)):
    """
    Moves specific riders from source_zone to target_zone.
    Admin selects riders after reviewing skill breakdown from GET /riders.
    """
    moved = 0
    for rider_id in req.rider_ids:
        state = db.query(RiderState).filter(
            RiderState.run_id == req.run_id,
            RiderState.rider_id == rider_id,
            RiderState.current_zone_id == req.source_zone,
            RiderState.status == "ONLINE"
        ).first()

        if not state:
            raise HTTPException(
                status_code=404,
                detail=f"Rider {rider_id} not found as ONLINE in Zone {req.source_zone}"
            )

        state.current_zone_id = req.target_zone
        moved += 1

    db.commit()
    return {
        "message": f"Moved {moved} riders from Zone {req.source_zone} to Zone {req.target_zone}",
        "moved_count": moved
    }


# ─── Activate Riders (INACTIVE → ONLINE) ─────────────────────────────────────

class ActivateRequest(BaseModel):
    run_id: str
    rider_ids: List[str]


@router.post("/activate-riders")
def activate_riders(req: ActivateRequest, db: Session = Depends(get_db)):
    """
    Brings selected INACTIVE riders ONLINE.
    Supply-side lever to relieve congestion without moving anyone.
    """
    activated = 0
    for rider_id in req.rider_ids:
        state = db.query(RiderState).filter(
            RiderState.run_id == req.run_id,
            RiderState.rider_id == rider_id,
            RiderState.status == "INACTIVE"
        ).first()

        if state:
            state.status = "ONLINE"
            activated += 1

    db.commit()
    return {
        "message": f"Activated {activated} riders",
        "activated_count": activated
    }


# ─── Strategy A: ETA Extension ──────────────────────────────────────────────

BASE_DELIVERY_MINUTES = 30  # Standard quick-commerce promise


def compute_eta_extension(current_load: int, online_riders: int) -> int:
    """
    Derives the ETA extension from the zone's overload ratio.
    max_capacity uses the same ×2 multiplier as the Strategy Pattern.
    """
    max_capacity = online_riders * 2
    if max_capacity == 0:
        return 45  # Zero riders → maximum extension

    ratio = current_load / max_capacity
    if ratio < 0.8:
        return 0    # SAFE — no extension needed
    elif ratio < 1.0:
        return 15   # RISK — approaching limit
    elif ratio < 1.3:
        return 30   # LOCKED — clearly over capacity
    else:
        return 45   # SEVERE — far over capacity


class ExtendETARequest(BaseModel):
    run_id: str
    zone_id: int
    target_hour: int


@router.post("/extend-eta")
def extend_eta(req: ExtendETARequest, db: Session = Depends(get_db)):
    """
    Strategy A: ETA Extension (Expectation Management).
    Extension time is auto-computed from the zone's overload ratio —
    the admin clicks a button, the system does the math.
    Checkout shows BASE_ETA (30 min) + computed extension.
    Zero orders are touched. Only slot metadata is updated.
    """
    slot = db.query(SlotDemand).filter(
        SlotDemand.run_id == req.run_id,
        SlotDemand.zone_id == req.zone_id,
        SlotDemand.target_hour == req.target_hour
    ).first()

    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    # Get live rider count for this zone to compute capacity
    online_riders = db.query(RiderState).filter(
        RiderState.run_id == req.run_id,
        RiderState.current_zone_id == req.zone_id,
        RiderState.status == "ONLINE"
    ).count()

    extension = compute_eta_extension(slot.current_load, online_riders)
    total_eta = BASE_DELIVERY_MINUTES + extension

    # Reuse surge_fee_active as the ETA-extended flag
    # surge_fee_amount stores the TOTAL eta minutes (base + extension)
    slot.surge_fee_active = True
    slot.surge_fee_amount = float(total_eta)

    db.commit()
    return {
        "message": f"Zone {req.zone_id} at {req.target_hour}:00 — ETA extended to {total_eta} min",
        "zone_id": req.zone_id,
        "target_hour": req.target_hour,
        "base_eta_minutes": BASE_DELIVERY_MINUTES,
        "extension_minutes": extension,
        "total_eta_minutes": total_eta,
        "overload_ratio": round(slot.current_load / max(online_riders * 2, 1), 2)
    }


# ─── Strategy B: Steer Demand (Off-Peak) ─────────────────────────────────────

class SteerDemandRequest(BaseModel):
    run_id: str
    zone_id: int
    from_hour: int          # The congested peak hour
    to_hour: int            # The off-peak hour to redirect to
    steer_percentage: float = 0.20   # Fraction of orders to redirect


@router.post("/steer-demand")
def steer_demand(req: SteerDemandRequest, db: Session = Depends(get_db)):
    """
    Strategy B: Off-peak steering.
    Reassigns a percentage of pending orders from a congested slot to a quieter one.
    Simulates the platform offering a discount/incentive to shift delivery windows.
    Orders are NEVER cancelled — they are fulfilled in a different time window.
    """
    from_slot = db.query(SlotDemand).filter(
        SlotDemand.run_id == req.run_id,
        SlotDemand.zone_id == req.zone_id,
        SlotDemand.target_hour == req.from_hour
    ).first()

    to_slot = db.query(SlotDemand).filter(
        SlotDemand.run_id == req.run_id,
        SlotDemand.zone_id == req.zone_id,
        SlotDemand.target_hour == req.to_hour
    ).first()

    if not from_slot or not to_slot:
        raise HTTPException(status_code=404, detail="Source or target slot not found for this run")

    # Fetch pending orders in the congested slot
    pending_orders = db.query(Order).filter(
        Order.run_id == req.run_id,
        Order.zone_id == req.zone_id,
        Order.status == "Pending",
        Order.chosen_slot == from_slot.slot_window
    ).all()

    steer_count = int(len(pending_orders) * req.steer_percentage)

    if steer_count > 0:
        orders_to_move = random.sample(pending_orders, steer_count)
        for o in orders_to_move:
            o.chosen_slot = to_slot.slot_window  # Reassign — not cancel

    # Adjust aggregated load on both slots to match
    from_slot.current_load = max(0, from_slot.current_load - steer_count)
    to_slot.current_load = to_slot.current_load + steer_count

    db.commit()
    return {
        "message": f"Steered {steer_count} orders from {req.from_hour}:00 → {req.to_hour}:00 in Zone {req.zone_id}",
        "orders_reassigned": steer_count,
        "from_slot_new_load": from_slot.current_load,
        "to_slot_new_load": to_slot.current_load
    }
