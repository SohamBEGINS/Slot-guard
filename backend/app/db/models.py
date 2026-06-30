from sqlalchemy import Column, String, Boolean, Integer, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import declarative_base
import uuid
from datetime import datetime

Base = declarative_base()

class SimulationRun(Base):
    __tablename__ = "simulation_runs"

    run_id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    run_name = Column(String)
    status = Column(String, default="ACTIVE") # 'ACTIVE' or 'ARCHIVED'
    config = Column(JSON) # Stores weather, traffic, fleet_deployment_pct, etc.
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Rider(Base):
    __tablename__ = "riders"

    rider_id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    name = Column(String)
    phone = Column(String)
    skill_tier = Column(String) # 'EXPERT', 'STANDARD', 'TRAINEE'
    home_zone_id = Column(Integer) # Starting zone, 1-8
    created_at = Column(DateTime, default=datetime.utcnow)

class RiderState(Base):
    __tablename__ = "rider_states"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    run_id = Column(String, ForeignKey("simulation_runs.run_id"))
    rider_id = Column(String, ForeignKey("riders.rider_id"))
    current_zone_id = Column(Integer)
    status = Column(String) # 'INACTIVE' or 'ONLINE'
    last_ping = Column(DateTime, default=datetime.utcnow)

class Order(Base):
    __tablename__ = "orders"
    
    order_id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    run_id = Column(String, ForeignKey("simulation_runs.run_id"))
    timestamp = Column(DateTime)
    zone_id = Column(Integer)
    chosen_slot = Column(String)
    status = Column(String, default="Pending") # 'Pending', 'SURGE_PRICED', 'RESCHEDULED_INCENTIVE'
    surge_fee = Column(Float, default=0.0) # Tracks the extra revenue applied

class SlotDemand(Base):
    __tablename__ = "slot_demand"
    
    demand_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    run_id = Column(String, ForeignKey("simulation_runs.run_id"))
    date = Column(String) 
    zone_id = Column(Integer)
    target_hour = Column(Integer) 
    slot_window = Column(String) 
    current_load = Column(Integer, default=0)
    surge_fee_active = Column(Boolean, default=False)
    surge_fee_amount = Column(Float, default=0.0)
