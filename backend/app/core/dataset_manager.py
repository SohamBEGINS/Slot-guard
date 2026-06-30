import os
import io
import boto3
import pandas as pd


class DatasetManager:
    """
    Singleton that fetches final_ml_dataset2.csv from DagsHub S3 storage
    exactly ONCE on server startup and caches it in memory.
    Columns: Order_Date, zone_id, Weather, Traffic, Is_Weekend, Is_Festival,
             Current_Load, Total_Demand

    Design note:
    We inject mean(Current_Load) — NOT Total_Demand — as slot_demand.current_load.
    Current_Load is the "orders already committed" input feature that XGBoost reads.
    Total_Demand is the target the model predicts. Injecting Total_Demand would 
    collapse the input/output distinction and make every slot appear instantly LOCKED.
    """
    _instance = None
    _df: pd.DataFrame = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DatasetManager, cls).__new__(cls)
        return cls._instance

    def load_dataset(self):
        if self._df is not None:
            print("Dataset already loaded. Skipping.")
            return

        print("Fetching dataset from DagsHub S3 storage...")

        token = os.environ.get("DAGSHUB_PAT") or os.environ.get("MLFLOW_TRACKING_PASSWORD")
        
        if not token:
            print("WARNING: No DagsHub token found in environment. Dataset load will fail.")
            DatasetManager._df = pd.DataFrame(columns=["Order_Date", "zone_id", "Weather", "Traffic", "Is_Weekend", "Is_Festival", "Current_Load", "Hour"])
            return

        token = token.strip()

        # We must have this dataset. If DagsHub has a network hiccup, we retry up to 3 times.
        import time
        max_retries = 3
        for attempt in range(max_retries):
            try:
                import dagshub.auth
                from dagshub.streaming import DagsHubFilesystem
                
                dagshub.auth.add_app_token(token)
                fs = DagsHubFilesystem(project_root=".", repo_url="https://dagshub.com/SohamBEGINS/Slot-guard")
                
                with fs.open("s3:/Slot-guard/final_ml_dataset2.csv", "rb") as f:
                    df = pd.read_csv(f)

                df["Hour"] = pd.to_datetime(df["Order_Date"]).dt.hour
                DatasetManager._df = df
                print(f"Dataset loaded successfully. Shape: {DatasetManager._df.shape}")
                return # Success, exit the retry loop

            except Exception as e:
                print(f"WARNING: Failed to fetch dataset from DagsHub (Attempt {attempt + 1}/{max_retries}): {e}")
                if attempt < max_retries - 1:
                    time.sleep(2) # Wait 2 seconds before retrying
                else:
                    # If we exhausted all retries, crash the server immediately (Fail-Fast)
                    print("CRITICAL ERROR: Could not load the required dataset. Server cannot start.")
                    raise RuntimeError("Failed to load ML dataset from DagsHub after 3 attempts.") from e

    def get_committed_load_per_zone(
        self,
        weather: str,
        traffic: str,
        is_festival: bool,
        target_hour: int,
    ) -> dict[int, int]:
        """
        Returns mean(Current_Load) per zone for the given hour and conditions.
        This represents orders already committed at the time of simulation init.
        The dataset naturally produces lower Current_Load for off-peak hours,
        giving an honest decreasing profile across t, t+1, t+2, t+3 slots
        without any synthetic decay formula.

        Fallback priority:
        1. weather + traffic + festival + hour  (most specific)
        2. weather + festival + hour
        3. hour only
        4. global mean of Current_Load (~18 orders)
        """
        df = self._df
        festival_val = 1 if is_festival else 0
        ZONES = list(range(1, 9))

        # Priority 1: All 4 conditions + hour
        filtered = df[
            (df["Weather"] == weather) &
            (df["Traffic"] == traffic) &
            (df["Is_Festival"] == festival_val) &
            (df["Hour"] == target_hour)
        ]

        # Priority 2: Drop traffic
        if len(filtered) < 50:
            filtered = df[
                (df["Weather"] == weather) &
                (df["Is_Festival"] == festival_val) &
                (df["Hour"] == target_hour)
            ]

        # Priority 3: Hour only
        if len(filtered) < 50:
            filtered = df[df["Hour"] == target_hour]

        # Priority 4: Global fallback
        if len(filtered) < 50:
            filtered = df

        result = {}
        for zone in ZONES:
            zone_rows = filtered[filtered["zone_id"] == zone]
            if len(zone_rows) > 0:
                result[zone] = int(zone_rows["Current_Load"].mean())
            else:
                result[zone] = 18  # Global Current_Load average fallback
        return result
