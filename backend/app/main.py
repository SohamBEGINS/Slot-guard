from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.api.routes import router as checkout_router
from app.core.ml_manager import MLManager
from app.db.database import engine
from app.db.models import Base

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Generate the PostgreSQL Tables in Supabase automatically!
    print("Creating Database Tables in Supabase...")
    Base.metadata.create_all(bind=engine)
    
    # 2. Boot up the XGBoost Singleton
    print("Initializing ML Manager...")
    ml_manager = MLManager()
    
    # NOTE: You must ensure your local MLflow server is running in another terminal 
    # (uv run mlflow ui) so it can download the model!
    # ml_manager.load_model("models:/Delivery_Slot_XGBoost@production")
    
    yield
    print("Shutting down gracefully...")

# Initialize the FastAPI application
app = FastAPI(
    title="Delivery Slot Prediction System",
    description="Backend for Dynamic Rebalancing and Slot Management",
    lifespan=lifespan
)

# Attach our routes
app.include_router(checkout_router, prefix="/api/v1/checkout", tags=["Checkout"])

@app.get("/")
def health_check():
    return {"status": "System Online", "version": "1.0.0"}
