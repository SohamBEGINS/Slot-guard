from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.api.simulation import router as simulation_router
from app.api.routes import router as checkout_router
from app.core.ml_manager import MLManager
from app.db.database import engine, SessionLocal
from app.db.models import Base, Rider
from fastapi.middleware.cors import CORSMiddleware
import uuid
import random

def seed_asymmetric_riders():
    """Seeds the permanent workforce if the DB is empty."""
    db = SessionLocal()
    try:
        # Check if riders already exist
        if db.query(Rider).count() > 0:
            print("Riders already seeded. Skipping.")
            return

        print("Seeding asymmetric riders...")
        
        # Asymmetric Capacity Distribution (Total = 312 riders)
        # Zone 1 = Old City (Understaffed)
        # Zone 2 = Business (Resource Pool)
        zone_capacities = {1: 25, 2: 50, 3: 40, 4: 30, 5: 35, 6: 55, 7: 40, 8: 37}
        
        names = ["Arjun K.", "Raj M.", "Priya T.", "Anil S.", "Kavita R.", "Rahul D.", "Vikram P.", "Neha S.", "Suresh V.", "Anita K."]
        skills = ["EXPERT", "STANDARD", "STANDARD", "TRAINEE"] # Weighted: 25% Expert, 50% Standard, 25% Trainee
        
        riders_to_insert = []
        for zone, capacity in zone_capacities.items():
            for _ in range(capacity):
                riders_to_insert.append(
                    Rider(
                        rider_id=str(uuid.uuid4()),
                        name=random.choice(names),
                        phone=f"+91 98{random.randint(10000000, 99999999)}",
                        skill_tier=random.choice(skills),
                        home_zone_id=zone
                    )
                )
        
        db.add_all(riders_to_insert)
        db.commit()
        print(f"Successfully seeded {len(riders_to_insert)} permanent riders asymmetrically across 8 zones.")
        
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    from dotenv import load_dotenv
    load_dotenv()

    # 1. Generate the PostgreSQL Tables in Supabase automatically!
    print("Creating Database Tables in Supabase...")
    Base.metadata.create_all(bind=engine)
    
    # 2. Seed the permanent workforce
    seed_asymmetric_riders()
    
    # 3. Boot up the XGBoost Singleton
    print("Initializing ML Manager...")
    ml_manager = MLManager()
    # (Model loading has been moved to the /initialize route for a dramatic frontend load sequence!)
    
    yield
    print("Shutting down gracefully...")

# Initialize the FastAPI application
app = FastAPI(
    title="Delivery Slot Prediction System",
    description="Backend for Dynamic Rebalancing and Slot Management",
    lifespan=lifespan
)

# Add CORS Middleware to allow requests from the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach our routes
# app.include_router(checkout_router, prefix="/api/v1/checkout", tags=["Checkout"])
# app.include_router(simulation_router, prefix="/api/v1/simulation", tags=["Simulation"])

@app.get("/")
def health_check():
    return {"status": "System Online", "version": "1.0.0"}
