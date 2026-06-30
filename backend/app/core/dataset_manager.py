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

        username = os.environ.get("MLFLOW_TRACKING_USERNAME")
        password = os.environ.get("MLFLOW_TRACKING_PASSWORD")

        s3 = boto3.client(
            "s3",
            endpoint_url="https://dagshub.com/SohamBEGINS/Slot-guard.s3",
            aws_access_key_id=username,
            aws_secret_access_key=password,
        )

        response = s3.get_object(Bucket="dvc", Key="final_ml_dataset2.csv")
        df = pd.read_csv(io.BytesIO(response["Body"].read()))

        # Extract Hour from Order_Date once at load time — reused in every query
        df["Hour"] = pd.to_datetime(df["Order_Date"]).dt.hour

        DatasetManager._df = df
        print(f"Dataset loaded successfully. Shape: {DatasetManager._df.shape}")

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
