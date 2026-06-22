import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
import os

def prepare_data():
    # 1. Ensure the processed output directory exists
    os.makedirs("data/processed", exist_ok=True)
    
    # 2. Load the raw synthetic dataset
    print("Loading raw dataset...")
    df = pd.read_csv("data/raw/final_ml_dataset2.csv")
    
    print("Performing Feature Engineering (Ordinal & Cyclical)...")

    # 1. Ordinal Encoding for Hierarchy
    weather_map = {'CLEAR': 1.0, 'WINDY': 1.2, 'RAIN': 1.5, 'STORM': 1.8}
    traffic_map = {'LOW': 1.0, 'MEDIUM': 1.2, 'HIGH': 1.5, 'GRIDLOCK': 2.0}

    df['Weather_Severity'] = df['Weather'].map(weather_map)
    df['Traffic_Encoded'] = df['Traffic'].map(traffic_map)

    # 2. Cyclical Encoding for Time (Extract Hour from Date)
    df['Order_Date'] = pd.to_datetime(df['Order_Date'])
    hours = df['Order_Date'].dt.hour


    df['Hour_Sin'] = np.sin(2 * np.pi * hours / 24)
    df['Hour_Cos'] = np.cos(2 * np.pi * hours / 24)

    # 3. Boolean to Int (Safer for XGBoost)
    df['Is_Weekend'] = df['Is_Weekend'].astype(int)
    df['Is_Festival'] = df['Is_Festival'].astype(int)
    
    # 4. Select Final Features (Dropping raw text columns)
    final_features = [
        'zone_id', 'Hour_Sin', 'Hour_Cos', 'Is_Weekend', 'Is_Festival', 
        'Weather_Severity', 'Traffic_Encoded', 'Current_Load', 'Total_Demand'
    ]
    
    df_processed = df[final_features]
    print("Splitting data into train and test sets...")
    train_df, test_df = train_test_split(df_processed, test_size=0.2, random_state=42)
    
    # 4. Save the processed data
    train_df.to_csv("data/processed/train.csv", index=False)
    test_df.to_csv("data/processed/test.csv", index=False)
    print("Data preparation complete! Saved to data/processed/")

if __name__ == "__main__":
    prepare_data()
