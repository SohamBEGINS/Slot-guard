from sqlalchemy.orm import Session
from datetime import datetime
import sys
import os
from app.db.models import ActiveRider, SlotDemand, Region

class SQLRiderRepository:
    def __init__(self, db: Session):
        self.db = db
        
    def get_active_riders(self, zone_id: int) -> int:
        """
        Calculates live supply by counting ONLINE riders in the zone,
        and strictly adding/subtracting the Admin's manual rebalancing counts.
        """
        # 1. Count actual physical riders on the road
        rider_count = self.db.query(ActiveRider).filter(
            ActiveRider.current_zone_id == zone_id,
            ActiveRider.status == "ONLINE"
        ).count()
        
        # 2. Apply strict Integer adjustments (e.g., +10 from another zone)
        region = self.db.query(Region).filter(Region.zone_id == zone_id).first()
        adjustment = region.manual_rider_adjustment if region else 0
        
        # Ensure we never return a negative number of riders
        return max(0, rider_count + adjustment)


class SQLSlotDemandRepository:
    def __init__(self, db: Session):
        self.db = db
        
    def get_current_load(self, zone_id: int, slot_time: datetime) -> int:
        """
        Fetches the momentum (early bookings) for a specific zone and hour.
        """
        date_str = slot_time.strftime("%Y-%m-%d")
        target_hour = slot_time.hour
        
        slot_record = self.db.query(SlotDemand).filter(
            SlotDemand.zone_id == zone_id,
            SlotDemand.date == date_str,
            SlotDemand.target_hour == target_hour
        ).first()
        
        return slot_record.current_load if slot_record else 0
