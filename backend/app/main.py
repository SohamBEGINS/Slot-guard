from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.api.simulation import router as simulation_router
from app.api.routes import router as checkout_router
from app.core.ml_manager import MLManager
from app.db.database import engine
from app.db.models import Base
from fastapi.middleware.cors import CORSMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    from dotenv import load_dotenv
    load_dotenv()

    # 1. Generate the PostgreSQL Tables in Supabase automatically!
    print("Creating Database Tables in Supabase...")
    Base.metadata.create_all(bind=engine)
    
    # 2. Boot up the XGBoost Singleton
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
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach our routes
app.include_router(checkout_router, prefix="/api/v1/checkout", tags=["Checkout"])
app.include_router(simulation_router, prefix="/api/v1/simulation", tags=["Simulation"])

@app.get("/")
def health_check():
    return {"status": "System Online", "version": "1.0.0"}
