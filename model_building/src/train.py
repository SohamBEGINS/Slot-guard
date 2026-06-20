import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, root_mean_squared_error
from sklearn.model_selection import RandomizedSearchCV
import mlflow
import mlflow.xgboost
import matplotlib.pyplot as plt
import os
import pickle

def train_model():
    print("Loading processed data...")
    train_df = pd.read_csv("data/processed/train.csv")
    test_df = pd.read_csv("data/processed/test.csv")
    
    # Separate features and target
    X_train = train_df.drop(columns=['Total_Demand'])
    y_train = train_df['Total_Demand']
    X_test = test_df.drop(columns=['Total_Demand'])
    y_test = test_df['Total_Demand']
    
    # MLflow Setup
    mlflow.set_tracking_uri("sqlite:///mlflow.db")
    mlflow.set_experiment("Delivery_Slot_Prediction")
    
    with mlflow.start_run():
        print("Starting Hyperparameter Tuning (RandomizedSearch)...")
        
        # 1. Define the grid of parameters to test
        param_grid = {
            'max_depth': [3, 5, 7],
            'learning_rate': [0.01, 0.05, 0.1, 0.2],
            'n_estimators': [50, 100, 200],
            'subsample': [0.8, 1.0]
        }
        
        # 2. Run RandomizedSearchCV to find best params
        xgb_base = xgb.XGBRegressor(random_state=42)
        random_search = RandomizedSearchCV(
            estimator=xgb_base, 
            param_distributions=param_grid, 
            n_iter=5,  # Only tests 5 random combinations to save time
            scoring='neg_root_mean_squared_error', 
            cv=3, 
            verbose=1, 
            random_state=42
        )
        random_search.fit(X_train, y_train)
        
        best_params = random_search.best_params_
        print(f"Best Parameters found: {best_params}")
        mlflow.log_params(best_params) # Log best params to MLflow
        
        # 3. Train final model WITH eval_set to get learning curves
        print("Training final model with evaluation sets...")
        final_model = xgb.XGBRegressor(**best_params, random_state=42)
        eval_set = [(X_train, y_train), (X_test, y_test)]
        
        final_model.fit(X_train, y_train, eval_set=eval_set, verbose=False)
        
        # 4. Check for Overfitting
        train_preds = final_model.predict(X_train)
        test_preds = final_model.predict(X_test)
        
        train_rmse = root_mean_squared_error(y_train, train_preds)
        test_rmse = root_mean_squared_error(y_test, test_preds)
        test_mae = mean_absolute_error(y_test, test_preds)
        
        print("-" * 30)
        print(f"Train RMSE: {train_rmse:.2f}")
        print(f"Test RMSE:  {test_rmse:.2f}")
        print(f"Test MAE:   {test_mae:.2f}")
        print("-" * 30)
        
        mlflow.log_metric("train_rmse", train_rmse)
        mlflow.log_metric("test_rmse", test_rmse)
        mlflow.log_metric("test_mae", test_mae)
        
        # 5. Generate and Save the Learning Curve Plot
        results = final_model.evals_result()
        epochs = len(results['validation_0']['rmse'])
        x_axis = range(0, epochs)
        
        plt.figure(figsize=(10, 6))
        plt.plot(x_axis, results['validation_0']['rmse'], label='Train RMSE', color='blue')
        plt.plot(x_axis, results['validation_1']['rmse'], label='Test RMSE', color='orange')
        plt.legend()
        plt.ylabel('RMSE')
        plt.xlabel('Boosting Rounds (Trees)')
        plt.title('XGBoost Learning Curve (Overfitting Check)')
        
        # Save plot locally
        os.makedirs("artifacts", exist_ok=True)
        plot_path = "artifacts/learning_curve.png"
        plt.savefig(plot_path)
        plt.close()
        
        # Tell MLflow to save the image to the dashboard!
        mlflow.log_artifact(plot_path)
        
        # 6. Save the final model
        mlflow.xgboost.log_model(final_model, "xgboost-model")
        os.makedirs("saved_models", exist_ok=True)
        with open("saved_models/xgboost_demand_model.pkl", "wb") as f:
            pickle.dump(final_model, f)
            
        print("Upgraded Training complete!")

if __name__ == "__main__":
    train_model()
