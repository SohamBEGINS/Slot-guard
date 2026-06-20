import pandas as pd
from sklearn.model_selection import train_test_split
import os

def prepare_data():
    # 1. Ensure the processed output directory exists
    os.makedirs("data/processed", exist_ok=True)
    
    # 2. Load the raw synthetic dataset
    print("Loading raw dataset...")
    df = pd.read_csv("data/raw/final_ml_dataset.csv")
    
    # 3. Split into Train (80%) and Test (20%)
    print("Splitting data into train and test sets...")
    train_df, test_df = train_test_split(df, test_size=0.2, random_state=42)
    
    # 4. Save the processed data
    train_df.to_csv("data/processed/train.csv", index=False)
    test_df.to_csv("data/processed/test.csv", index=False)
    print("Data preparation complete! Saved to data/processed/")

if __name__ == "__main__":
    prepare_data()
