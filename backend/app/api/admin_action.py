from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
import random

from app.db.database import get_db
from app.db.models import RiderState, Rider, Order, SlotDemand, SimulationRun
from app.core.strategy import get_capacity_strategy, WeatherCondition

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


# ─── AI Smart Roster Builder ──────────────────────────────────────────────────

class DraftRosterRequest(BaseModel):
    run_id: str
    target_zone: int
    safe_zones: dict[int, int]  # zone_id -> capacity_padding
    excess_capacity: int

@router.post("/draft-roster")
def draft_roster(req: DraftRosterRequest, db: Session = Depends(get_db)):
    """
    Returns a human-in-the-loop AI recommended roster for redeployment.
    Pulls available riders from SAFE zones, prioritizes EXPERT > STANDARD.
    Dynamically calculates needed riders based on weather/festival strategy.
    """
    if not req.safe_zones:
        return {"riders_needed": 0, "roster": []}

    # 1. Determine how many riders are needed using the core Strategy
    sim_run = db.query(SimulationRun).filter(SimulationRun.run_id == req.run_id).first()
    if not sim_run:
        raise HTTPException(status_code=404, detail="Run not found")
        
    config = sim_run.config or {}
    weather = WeatherCondition(config.get("weather", "CLEAR"))
    is_festival = config.get("is_festival", False)
    
    strategy = get_capacity_strategy(weather, is_festival)
    single_rider_capacity = strategy.calculate_capacity(1)
    
    import math
    riders_needed = 1
    if single_rider_capacity > 0:
        riders_needed = max(1, math.ceil(req.excess_capacity / single_rider_capacity))

    # Calculate export quotas to protect safe zones
    zone_quotas = {}
    export_counts = {}
    for z_id, padding in req.safe_zones.items():
        quota = math.floor(padding / single_rider_capacity) if single_rider_capacity > 0 else 0
        zone_quotas[z_id] = quota
        export_counts[z_id] = 0

    safe_zone_ids = list(req.safe_zones.keys())

    # 2. Fetch available riders from safe zones
    results = db.query(RiderState, Rider).join(
        Rider, RiderState.rider_id == Rider.rider_id
    ).filter(
        RiderState.run_id == req.run_id,
        RiderState.current_zone_id.in_(safe_zone_ids),
        RiderState.status == "ONLINE"
    ).all()

    # 3. Sort logic: EXPERT > STANDARD > TRAINEE
    tier_weight = {"EXPERT": 3, "STANDARD": 2, "TRAINEE": 1}
    results.sort(key=lambda x: tier_weight.get(x[1].skill_tier, 0), reverse=True)

    roster = []
    # Return riders needed + some alternatives
    limit = riders_needed + 4
    for state, rider in results:
        z_id = state.current_zone_id
        
        # Protect the safe zone from turning red!
        if export_counts.get(z_id, 0) >= zone_quotas.get(z_id, 0):
            continue 
            
        export_counts[z_id] = export_counts.get(z_id, 0) + 1
        
        roster.append({
            "rider_id": rider.rider_id,
            "name": rider.name,
            "skill_tier": rider.skill_tier,
            "source_zone": state.current_zone_id,
            "recommended": len(roster) < riders_needed
        })
        
        if len(roster) >= limit:
            break

    return {
        "riders_needed": riders_needed,
        "roster": roster
    }


# ─── Rebalance Riders ─────────────────────────────────────────────────────────

class RebalanceRequest(BaseModel):
    run_id: str
    target_zone: int
    rider_ids: List[str]  # Admin hand-picks specific riders after skill inspection


@router.post("/rebalance-riders")
def rebalance_riders(req: RebalanceRequest, db: Session = Depends(get_db)):
    """
    Moves specific riders from their current zones to target_zone.
    """
    moved = 0
    for rider_id in req.rider_ids:
        state = db.query(RiderState).filter(
            RiderState.run_id == req.run_id,
            RiderState.rider_id == rider_id,
            RiderState.status == "ONLINE"
        ).first()

        if not state:
            raise HTTPException(
                status_code=404,
                detail=f"Rider {rider_id} not found as ONLINE"
            )

        state.current_zone_id = req.target_zone
        moved += 1

    db.commit()
    return {
        "message": f"Moved {moved} riders to Zone {req.target_zone}",
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


# ─── Strategy B: Steer Demand (Off-Peak) ─────────────────────────────────────

class SteerDemandRequest(BaseModel):
    run_id: str
    zone_id: int
    from_hour: int          # The congested peak hour
    excess_orders: int      # Calculated by frontend based on ML prediction
    target_headrooms: dict[str, int] = {} # Calculated by frontend (capacity - predicted_demand)


@router.post("/steer-demand")
def steer_demand(req: SteerDemandRequest, db: Session = Depends(get_db)):
    """
    Strategy B: Off-peak steering (Intelligent).
    Automatically calculates EXACTLY how many orders exceed capacity.
    Automatically identifies the quietest future hour for this zone.
    Moves exactly the excess orders to the quiet hour.
    """
    from_slot = db.query(SlotDemand).filter(
        SlotDemand.run_id == req.run_id,
        SlotDemand.zone_id == req.zone_id,
        SlotDemand.target_hour == req.from_hour
    ).first()

    if not from_slot:
        raise HTTPException(status_code=404, detail="Source slot not found for this run")

    sim_run = db.query(SimulationRun).filter(SimulationRun.run_id == req.run_id).first()
    weather = sim_run.config.get("weather", "CLEAR")
    is_festival = sim_run.config.get("is_festival", False)

    # 1. Use the exact excess orders calculated by the UI (ML predicted - capacity)
    excess_orders = req.excess_orders

    if excess_orders <= 0:
        return {"message": "Zone is within capacity limits. No steering required.", "steered_count": 0, "moves": []}

    # 2. Waterfall: Get ALL future slots sorted by quietest first
    future_slots = db.query(SlotDemand).filter(
        SlotDemand.run_id == req.run_id,
        SlotDemand.zone_id == req.zone_id,
        SlotDemand.target_hour > req.from_hour
    ).order_by(SlotDemand.current_load.asc()).all()

    if not future_slots:
        raise HTTPException(status_code=400, detail="No future slots available to steer demand into.")

    # 3. Fetch pending orders in the congested slot
    pending_orders = db.query(Order).filter(
        Order.run_id == req.run_id,
        Order.zone_id == req.zone_id,
        Order.status == "Pending",
        Order.chosen_slot == from_slot.slot_window
    ).all()

    remaining_excess = min(excess_orders, len(pending_orders))
    total_steered = 0
    moves = []  # Deltas for the frontend to apply without re-querying ML
    orders_pool = list(pending_orders)  # Mutable copy for sampling
    random.shuffle(orders_pool)

    # 4. Waterfall across future slots, respecting headroom
    for target_slot in future_slots:
        if remaining_excess <= 0:
            break

        # Use the exact headroom calculated by the frontend (capacity - predicted_demand)
        headroom = req.target_headrooms.get(str(target_slot.target_hour), 0)
        
        if headroom <= 0:
            continue  # This slot is already at/over capacity, skip it

        # Move the minimum of: what we need to move, what this slot can absorb
        batch_size = min(remaining_excess, headroom)
        
        # Reassign the actual Order rows
        for j in range(batch_size):
            orders_pool[total_steered + j].chosen_slot = target_slot.slot_window

        # Update aggregated loads
        target_slot.current_load += batch_size
        
        moves.append({
            "target_hour": target_slot.target_hour,
            "orders_absorbed": batch_size,
            "new_load": target_slot.current_load
        })

        total_steered += batch_size
        remaining_excess -= batch_size

    # 5. Update the source slot
    from_slot.current_load = max(0, from_slot.current_load - total_steered)

    db.commit()
    return {
        "message": f"Steered {total_steered} excess orders from {req.from_hour}:00 across {len(moves)} quieter slot(s)",
        "orders_reassigned": total_steered,
        "unresolved_excess": remaining_excess,  # Orders that couldn't be placed anywhere
        "from_hour": req.from_hour,
        "from_slot_new_load": from_slot.current_load,
        "moves": moves  # Frontend applies these deltas directly — no ML re-query needed
    }

class DeployIncentiveRequest(BaseModel):
    run_id: str
    zone_id: int
    bonus_amount: int

@router.post("/deploy-incentive")
def deploy_incentive(req: DeployIncentiveRequest, db: Session = Depends(get_db)):
    import math
    import random
    from app.db.models import RiderState
    
    # 1. Fetch all INACTIVE riders in this zone
    inactive_riders = db.query(RiderState).filter(
        RiderState.run_id == req.run_id,
        RiderState.current_zone_id == req.zone_id,
        RiderState.status == "INACTIVE"
    ).all()
    
    if not inactive_riders:
        return {"message": "No inactive riders available to wake up.", "woke_up": 0, "conversion_pct": 0.0}
        
    # 2. The Sigmoid Math (S-Curve)
    # k = 0.1 (steepness), x0 = 40 (inflection point)
    # At Rs 40, exactly 50% convert. At Rs 10, ~4% convert. At Rs 80, ~98% convert.
    k = 0.1
    x0 = 40.0
    
    exponent = -k * (req.bonus_amount - x0)
    conversion = 1.0 / (1.0 + math.exp(exponent))
    
    wakes_count = int(len(inactive_riders) * conversion)
    
    if wakes_count == 0:
        return {"message": "Bonus too low to wake anyone up.", "woke_up": 0, "conversion_pct": round(conversion * 100, 1)}
        
    # 3. Shuffle and wake them up!
    random.shuffle(inactive_riders)
    woken_riders = inactive_riders[:wakes_count]
    
    for r in woken_riders:
        r.status = "ONLINE"
        
    db.commit()
    
    return {
        "message": f"Successfully woke up {wakes_count} riders!",
        "woke_up": wakes_count,
        "conversion_pct": round(conversion * 100, 1)
    }
