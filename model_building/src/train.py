import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, root_mean_squared_error
import mlflow
import mlflow.xgboost
import os
import pickle

def train_model():
    # 1. Load the processed data
    print("Loading processed data...")
    train_df = pd.read_csv("data/processed/train.csv")
    test_df = pd.read_csv("data/processed/test.csv")
    
    # Separate features (X) and target (y)
    X_train = train_df.drop(columns=['Total_Demand'])
    y_train = train_df['Total_Demand']
    X_test = test_df.drop(columns=['Total_Demand'])
    y_test = test_df['Total_Demand']
    
    # 2. Set up MLflow Tracking
    mlflow.set_tracking_uri("sqlite:///mlflow.db") # Saves logs locally in a sqlite DB
    mlflow.set_experiment("Delivery_Slot_Prediction")
    
    with mlflow.start_run():
        print("Training XGBoost Model...")
        
        # Hyperparameters
        params = {
            "max_depth": 6,
            "learning_rate": 0.1,
            "n_estimators": 100,
            "random_state": 42
        }
        
        # Log parameters to MLflow
        mlflow.log_params(params)
        
        # Train the model
        model = xgb.XGBRegressor(**params)
        model.fit(X_train, y_train)
        
        # 3. Evaluate the model
        predictions = model.predict(X_test)
        mae = mean_absolute_error(y_test, predictions)
        rmse = root_mean_squared_error(y_test, predictions)
        
        print(f"Model Performance - MAE: {mae:.2f}, RMSE: {rmse:.2f}")
        
        # Log metrics and the model itself to MLflow
        mlflow.log_metric("mae", mae)
        mlflow.log_metric("rmse", rmse)
        mlflow.xgboost.log_model(model, "xgboost-model")
        
        # 4. Save a local .pkl for the FastAPI backend to use later
        os.makedirs("saved_models", exist_ok=True)
        with open("saved_models/xgboost_demand_model.pkl", "wb") as f:
            pickle.dump(model, f)
            
        print("✅ Training complete! Model saved to saved_models/xgboost_demand_model.pkl")

if __name__ == "__main__":
    train_model()
