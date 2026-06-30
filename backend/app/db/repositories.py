from sqlalchemy.orm import Session
from datetime import datetime
from app.db.models import RiderState, SlotDemand


class SQLRiderRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_active_riders(self, zone_id: int, run_id: str) -> int:
        """
        Counts ONLINE riders in a specific zone for a specific simulation run.
        This replaces the old Region + manual_rider_adjustment approach.
        """
        return self.db.query(RiderState).filter(
            RiderState.run_id == run_id,
            RiderState.current_zone_id == zone_id,
            RiderState.status == "ONLINE"
        ).count()


class SQLSlotDemandRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_current_load(self, zone_id: int, slot_time: datetime, run_id: str) -> int:
        """
        Fetches committed order count for a specific zone, hour, and simulation run.
        """
        date_str = slot_time.strftime("%Y-%m-%d")
        target_hour = slot_time.hour

        slot_record = self.db.query(SlotDemand).filter(
            SlotDemand.run_id == run_id,
            SlotDemand.zone_id == zone_id,
            SlotDemand.date == date_str,
            SlotDemand.target_hour == target_hour
        ).first()

        return slot_record.current_load if slot_record else 0
