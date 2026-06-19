from sqlalchemy import Column, String, Boolean, Integer, Float, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base

Base = declarative_base()

# Schema to track local fulfillment areas
class Region(Base):
    __tablename__ = "regions"

    zone_id = Column(Integer, primary_key=True, index=True)
    zone_name  = Column(String)
    is_active = Column(Boolean, default=True)
    
    # MODIFIED: Renamed to represent the target ops goal, not the live limit
    base_fleet_capacity = Column(Integer) 
    
    # NEW: Admin toggle to pull riders from other zones (Dynamic Rebalancing)
    current_surge_multiplier = Column(Float, default=1.0) 

# NEW TABLE: Tracks the live physical supply of delivery drivers
class ActiveRider(Base):
    __tablename__ = "active_riders"
    
    rider_id = Column(String, primary_key=True, index=True)
    current_zone_id = Column(Integer, ForeignKey("regions.zone_id"))
    status = Column(String) # e.g., "ONLINE", "OFFLINE", "ON_DELIVERY"
    last_ping = Column(DateTime) # Tracks when they last checked in to drop idle riders

# This allows the admin to configure the available fixed time windows per region
class PlatformConfig(Base):
    __tablename__ = "platform_config"
    
    config_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    zone_id = Column(Integer, ForeignKey("regions.zone_id"))
    slot_start = Column(String) # e.g., "09:00"
    slot_end = Column(String)   # e.g., "10:00"
    is_closed = Column(Boolean, default=False) # For the Admin 'Force Close' button

# The raw transaction log (used later for continuous MLOps retraining)
class Order(Base):
    __tablename__ = "orders"
    
    order_id = Column(String, primary_key=True, index=True)
    timestamp = Column(DateTime)
    zone_id = Column(Integer, ForeignKey("regions.zone_id"))
    chosen_slot = Column(String)
    status = Column(String) # e.g., "Pending", "Delivered", "Delayed"

# High-velocity table your ML model uses to track current loads and make predictions
class SlotDemand(Base):
    __tablename__ = "slot_demand"
    
    demand_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    date = Column(String) # e.g., "2024-10-25"
    zone_id = Column(Integer, ForeignKey("regions.zone_id"))
    
    # MODIFIED: Storing the raw integer makes extracting 'Hour_Sin' instantly fast for XGBoost
    target_hour = Column(Integer) # e.g., 9 
    slot_window = Column(String) # e.g., "09:00-10:00" (Kept for UI display purposes)
    
    current_load = Column(Integer, default=0) # Tally of currently accepted orders for this slot