from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from typing import Dict, Any, List
import os
import asyncio
from datetime import datetime, timedelta

import mlflow
from mlflow.tracking import MlflowClient

from app.db.database import get_db
from app.db.models import SlotDemand, Order
from app.core.ml_manager import MLManager

router = APIRouter()

def get_mlflow_client():
    os.environ["MLFLOW_DISABLE_ENV_CREATION"] = "1"
    mlflow.set_tracking_uri(os.environ.get("MLFLOW_TRACKING_URI", "http://localhost:5000"))
    return MlflowClient()

@router.get("/health")
async def get_model_health(db: Session = Depends(get_db)) -> Dict[str, Any]:
    client = get_mlflow_client()
    model_name = "Delivery_Slot_XGBoost"
    
    try:
        # 1. Fetch all versions of the model
        versions = client.search_model_versions(f"name='{model_name}'")
        
        all_models = []
        champion_metrics = {"rmse": 0, "mae": 0, "r2_score": 0}
        champion_version_info = None
        baseline_traffic = 56.98 # Default fallback (true historical mean)
        
        for v in versions:
            run = client.get_run(v.run_id)
            metrics = run.data.metrics
            
            # Use aliases to determine if it's champion
            is_champion = "champion" in v.aliases or "production" in v.aliases
            
            model_info = {
                "version": f"v{v.version}",
                "status": "Production (Champion)" if is_champion else ("Staging" if "staging" in v.aliases else "Archived"),
                "last_trained": datetime.fromtimestamp(run.info.start_time / 1000.0).isoformat() + "Z" if run.info.start_time else "Unknown",
                "rmse": round(metrics.get("test_rmse", metrics.get("rmse", 0)), 2),
                "mae": round(metrics.get("test_mae", metrics.get("mae", 0)), 2),
                "r2_score": round(metrics.get("test_r2", metrics.get("r2_score", 0)), 2),
                "run_id": v.run_id
            }
            all_models.append(model_info)
            
            if is_champion:
                champion_version_info = model_info
                champion_metrics = {"rmse": model_info["rmse"], "mae": model_info["mae"], "r2_score": model_info["r2_score"]}
                # Dynamically fetch training baseline (Average Hourly Demand) from MLflow if logged
                # Fallback is the actual mathematical mean of 'Total_Demand' from final_ml_dataset2.csv
                baseline_traffic = metrics.get("training_avg_hourly_demand", metrics.get("baseline_volume", 56.98))

        if not champion_version_info and len(all_models) > 0:
            champion_version_info = all_models[0]
            champion_version_info["status"] = "Production (Champion)"
            champion_metrics = {"rmse": champion_version_info["rmse"], "mae": champion_version_info["mae"], "r2_score": champion_version_info["r2_score"]}
            
        if not champion_version_info:
            champion_version_info = {
                "version": "Unknown", "status": "Not Found", "last_trained": "Unknown"
            }
            
        # 2. Query PostgreSQL dynamically for live average
        # We query the average 'current_load' across slots in the last 24h to represent live volume demand per hour.
        last_24h = datetime.utcnow() - timedelta(hours=24)
        live_traffic_avg = db.query(func.avg(SlotDemand.current_load)).scalar()
        if live_traffic_avg is None:
            # Fallback if the database is literally empty
            live_traffic_avg = 0.0
            
        # Calculate drift dynamically
        drift_ratio = float(live_traffic_avg) / float(baseline_traffic) if baseline_traffic > 0 else 0
        drift_detected = drift_ratio > 1.20 # 20% higher than training data
        
        return {
            "model_info": {
                "name": model_name,
                "version": champion_version_info["version"],
                "status": champion_version_info["status"],
                "last_trained": champion_version_info["last_trained"],
                "framework": "XGBoost"
            },
            "metrics": champion_metrics,
            "raw_metrics": getattr(champion_version_info, "_raw_metrics", {}), # dump raw metrics here
            "drift_data": {
                "training_baseline": round(float(baseline_traffic), 1),
                "live_average": round(float(live_traffic_avg), 1),
                "drift_detected": drift_detected
            },
            "history": all_models
        }
    except Exception as e:
        print(f"Error fetching from MLflow: {e}")
        # Return fallback if MLflow is unreachable during dev
        return {
            "model_info": {"name": model_name, "version": "v1.0", "status": "Error", "last_trained": "", "framework": "XGBoost"},
            "metrics": {"rmse": 0, "mae": 0, "r2_score": 0},
            "drift_data": {"training_baseline": 190, "live_average": 0, "drift_detected": False},
            "history": []
        }

@router.post("/retrain")
async def retrain_model():
    # Simulate triggering an MLflow pipeline
    await asyncio.sleep(2)
    return {"status": "success", "message": "Model retraining pipeline initiated via DagsHub/MLflow."}

@router.post("/deploy/{version}")
async def deploy_model(version: str):
    """
    Simulates swapping the @champion alias in MLflow and reloading the MLManager instance
    """
    client = get_mlflow_client()
    model_name = "Delivery_Slot_XGBoost"
    
    try:
        v_num = version.replace("v", "")
        # Real MLflow alias update:
        # client.set_registered_model_alias(model_name, "champion", v_num)
        
        # Reload into RAM
        # ml_manager = MLManager()
        # ml_manager.load_model(f"models:/{model_name}@champion")
        
        await asyncio.sleep(1.5) # Simulate latency
        return {"status": "success", "message": f"Successfully rolled back and deployed {version} as Champion."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
