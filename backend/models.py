from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base

Base = declarative_base()

# Schema to track local fullfillment areas
class Region(Base):
    __tablename__ = "regions"

    zone_id = Column(Integer , primary_key=True , index = True)
    zone_name  = Column(String)
    is_active = Column(Boolean , default = True)
    max_fleet_capacity = Column(Integer)
    # crucial for the backend Rule Engine to compare against predicted demand

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
    slot_window = Column(String) # e.g., "09:00-10:00"
    current_load = Column(Integer, default=0) # Tally of currently accepted orders for this slot