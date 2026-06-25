# 🚀 Slot Guard | Predictive Hyperlocal Logistics

## 📖 Project Overview
Slot Guard is an enterprise-grade Machine Learning system designed for hyperlocal delivery platforms (e.g., Zepto, Blinkit, Instacart). It proactively prevents **"Delivery Collisions"**—scenarios where customer demand exceeds the physical capacity of active delivery riders.

By running an XGBoost Regression model against live city conditions (Weather, Traffic, Active Fleet), Slot Guard dynamically forecasts hourly delivery load and determines exactly when delivery time slots must be grayed out in a customer's checkout UI.

---

## 🏗️ Architecture & Tech Stack

### 🧠 The Prediction Engine
- **Machine Learning:** XGBoost, Scikit-learn, Pandas
- **MLOps (Model Registry):** DagsHub / MLflow. The backend dynamically fetches the `@champion` model weights directly from the cloud on startup.
- **Features Analyzed:** Hour of Day (Sine/Cosine), Weather Severity, Traffic Congestion, Festival Surges, and Baseline Order Momentum.

### ⚙️ The Backend (FastAPI)
- **Framework:** FastAPI, Pydantic, Python 3.12
- **Database:** Supabase (PostgreSQL) using SQLAlchemy ORM.
- **Package Manager:** `uv` (Ultra-fast Python package installer).
- **Core Design:** 
  - Uses the **Singleton Pattern** to guarantee the ML model is loaded into RAM exactly once.
  - Implements the **Strategy Pattern** to scale rider capacity (e.g., riders are mathematically slower in severe rain).

### 🧩 UML Class Diagram (Backend Architecture)
```mermaid
classDiagram
    %% API Layer
    class SimulationRouter {
        <<FastAPI Router>>
        +initialize_simulation()
        +get_demand_forecast()
    }
    class CheckoutSlotAPI {
        <<FastAPI Router>>
        +get_available_slots()
    }

    %% Facade Pattern (Orchestrator)
    class SlotAvailabilityFacade {
        <<Service Layer>>
        -ml_manager: MLManager
        -rider_repo: SQLRiderRepository
        -demand_repo: SQLSlotDemandRepository
        -strategy: CapacityStrategy
        +evaluate_slot(zone_id, slot_time) SlotStatus
    }

    %% Repository Pattern (Data Access)
    class SQLRiderRepository {
        +get_active_riders(zone_id) int
    }
    class SQLSlotDemandRepository {
        +get_current_load(zone_id, slot_time) int
    }

    %% Strategy Pattern (Business Logic)
    class CapacityStrategy {
        <<interface>>
        +calculate_capacity(active_riders) int
    }
    class StandardDayStrategy {
        +calculate_capacity(active_riders) int
    }
    class SevereWeatherStrategy {
        +calculate_capacity(active_riders) int
    }
    class FestivalStrategy {
        +calculate_capacity(active_riders) int
    }

    %% ML Singleton Pattern
    class MLManager {
        <<Singleton>>
        -model_in_memory
        +load_model(mlflow_uri)
        +predict_async(features) float <<Offloaded Thread>>
    }

    %% Relationships
    SimulationRouter --> SlotAvailabilityFacade : forecasts
    SimulationRouter --> MLManager : initializes model
    CheckoutSlotAPI --> SlotAvailabilityFacade : asks if slot is open
    SlotAvailabilityFacade --> SQLRiderRepository : fetches live supply
    SlotAvailabilityFacade --> SQLSlotDemandRepository : fetches momentum
    SlotAvailabilityFacade --> CapacityStrategy : executes math
    SlotAvailabilityFacade --> MLManager : fetches prediction
    
    CapacityStrategy <|-- StandardDayStrategy : implements
    CapacityStrategy <|-- SevereWeatherStrategy : implements
    CapacityStrategy <|-- FestivalStrategy : implements
```

### 🖥️ The Frontend (React + Vite)
- **Framework:** React, Vite, TailwindCSS
- **UI Components:** Radix UI, Framer Motion, Lucide Icons, Recharts (for dynamic data visualization).
- **Aesthetic:** A premium, "Cyberpunk/Command Center" design featuring glassmorphism, glowing emerald accents, and immersive terminal loaders.

---

## 🎮 The Mission Control Dashboard
We built an immersive Admin Dashboard to simulate logistics scenarios and visualize predictions:

1. **Setup Matrix:** A sleek dark-mode configuration screen where admins can inject variables:
   - Target Time
   - Active Fleet Size
   - Weather Conditions (Clear, Rain, Storm)
   - Traffic Levels
   - Festival/Holiday multipliers (Applies a 2x demand surge)
2. **Terminal Initialization:** A dynamic loading sequence that simulates the backend fetching weights from MLflow and wiping active simulation states.
3. **Zone Intelligence Dashboard:** 
   - Displays a 6-hour rolling chart (Demand vs Capacity).
   - Dynamically highlights **Red Zones** where the demand breaches the active rider capacity (A Delivery Collision).
   - Features tactical counters for "Total Demand", "Projected Riders", and "Breach Risk".

---

## 🛠️ Local Setup Instructions

### 1. Backend (FastAPI)
```bash
cd backend
# Install dependencies ultra-fast using uv
uv sync

# Create a .env file with your Supabase and DagsHub credentials:
# DATABASE_URL="postgresql://[user]:[password]@db.[project].supabase.co:5432/postgres"
# MLFLOW_TRACKING_URI="https://dagshub.com/..."
# MLFLOW_TRACKING_USERNAME="..."
# MLFLOW_TRACKING_PASSWORD="..."

# Run the backend server
uv run uvicorn app.main:app --reload
```

### 2. Frontend (React)
```bash
cd frontend
# Install Node dependencies
npm install

# Run the Vite development server
npm run dev
```

---

## 🚢 Deployment Strategy
This project is structured perfectly for a two-tier free deployment:
1. **Frontend:** Deployable instantly to **Vercel**. Provides ultra-fast edge delivery for the React app.
2. **Backend:** Deployable to **Railway or Render**. Unlike Vercel's serverless limits, Railway provides a persistent container (with 500MB+ RAM), ensuring the XGBoost model stays permanently loaded in memory for millisecond response times without timing out.
