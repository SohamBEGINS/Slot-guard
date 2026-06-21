import mlflow
import pandas as pd
import asyncio
from concurrent.futures import ThreadPoolExecutor

class MLManager:
    """
    Singleton Class to guarantee the heavy XGBoost model is loaded into RAM
    exactly ONCE per server boot, saving massive amounts of memory.
    """
    _instance = None
    _is_loaded = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MLManager, cls).__new__(cls)
            # Create a dedicated CPU ThreadPool for XGBoost math to bypass the Python GIL
            cls._instance.thread_pool = ThreadPoolExecutor(max_workers=4)
        return cls._instance

    def load_model(self, model_uri: str = "models:/Delivery_Slot_XGBoost@production"):
        """
        Loads the model directly from the MLflow registry using the @production alias!
        """
        if not self._is_loaded:
            print(f"Loading XGBoost model from MLflow: {model_uri}")
            
            # Note: We will configure this URI properly in a .env file later
            mlflow.set_tracking_uri("http://localhost:5000") 
            
            self.model = mlflow.pyfunc.load_model(model_uri)
            self._is_loaded = True
            print("Model successfully loaded into server RAM!")

    async def predict_async(self, features: dict) -> float:
        """
        Offloads the CPU-bound XGBoost predict() method to a background thread
        so it doesn't freeze the FastAPI async event loop for other customers.
        """
        if not self._is_loaded:
            raise RuntimeError("Model is not loaded. Call load_model() on server startup.")
            
        # Convert dictionary to Pandas DataFrame (required by MLflow pyfunc models)
        df = pd.DataFrame([features])
        
        # Run the heavy, blocking math operation in our ThreadPool
        loop = asyncio.get_running_loop()
        prediction = await loop.run_in_executor(
            self.thread_pool, 
            self.model.predict, 
            df
        )
        
        # XGBoost returns an array of predictions, we just want the single value
        return float(prediction[0])
