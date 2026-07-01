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

### 🧩 UML Class Diagram (System Integration)
```mermaid
classDiagram
    %% Frontend Layer
    class CheckoutPage {
        <<React Page>>
        -selectedZoneId: string
        -evaluatedSlots: dict
        +handleSlotClick(slot, idx)
        +getSlotVisuals(idx)
    }

    %% API Layer
    class SimulationRouter {
        <<FastAPI Router>>
        +initialize_simulation()
        +get_demand_forecast()
    }
    class CheckoutSlotAPI {
        <<FastAPI Router>>
        +evaluate_delivery_slot(request) CheckoutSlotResponse
    }

    %% Facade Pattern (Orchestrator)
    class SlotAvailabilityFacade {
        <<Service Layer>>
        -db: Session
        -rider_repo: SQLRiderRepository
        -demand_repo: SQLSlotDemandRepository
        -ml_manager: MLManager
        +evaluate_slot(request) CheckoutSlotResponse
    }

    %% Repository Pattern (Data Access)
    class SQLRiderRepository {
        +get_active_riders(zone_id, run_id) int
    }
    class SQLSlotDemandRepository {
        +get_current_load(zone_id, slot_time, run_id) int
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
    CheckoutPage ..> CheckoutSlotAPI : HTTP POST /api/v1/checkout/evaluate-slot
    SimulationRouter --> SlotAvailabilityFacade : forecasts
    SimulationRouter --> MLManager : initializes model
    CheckoutSlotAPI --> SlotAvailabilityFacade : delegates to
    SlotAvailabilityFacade --> SQLRiderRepository : queries supply
    SlotAvailabilityFacade --> SQLSlotDemandRepository : queries load
    SlotAvailabilityFacade --> CapacityStrategy : selects strategy
    SlotAvailabilityFacade --> MLManager : predicts demand
    
    CapacityStrategy <|-- StandardDayStrategy : implements
    CapacityStrategy <|-- SevereWeatherStrategy : implements
    CapacityStrategy <|-- FestivalStrategy : implements
```

### 🔗 Checkout Page & Facade Integration Flow
The real-time slot checking mechanism is wired through a decoupled frontend-backend pipeline:
1. **Frontend Initiation (`CheckoutPage.jsx`):** When a user clicks a delivery slot card, the `handleSlotClick` handler packages the active checkout context (`run_id`, `zone_id`, `slot_time`, and session parameters like `weather`, `traffic`, and `is_festival`) and sends an HTTP POST request to `/api/v1/checkout/evaluate-slot`.
2. **API Endpoint (`routes.py`):** The `evaluate_delivery_slot` route receives the JSON payload, instantiates a stateful `SlotAvailabilityFacade` passing the SQLAlchemy DB session, and awaits the evaluation.
3. **Facade Orchestration (`facade.py`):** The `SlotAvailabilityFacade` coordinates data querying and model evaluation:
   - Fetches the active fleet size (`SQLRiderRepository`) and current slot orders (`SQLSlotDemandRepository`) scoped to the active `run_id`.
   - Uses `CapacityStrategy` to calculate the dynamic rider capacity limit (adjusting for weather delays or holiday bonuses).
   - Generates the non-linear feature matrices (e.g., sine/cosine temporal values) and passes them to the thread-pool-offloaded `MLManager` singleton.
   - Inspects the DB to resolve if any manual admin overrides or dynamic surge fees are active.
4. **Client-Side Rendering:** The backend returns a `CheckoutSlotResponse`. The `CheckoutPage` component saves this in its `evaluatedSlots` state, and the `getSlotVisuals` helper dynamically renders visual statuses based on the response details:
   - **Unavailable:** If `is_available` is `false`, the slot is greyed out.
   - **High Volume Delay:** If `surge_fee_active` is `true`, it flags the slot with warning badges and applies delivery delay details.
   - **Fast Filling:** If predicted demand exceeds 80% of live capacity, the slot is colored amber with a surcharge.
   - **Available:** Normal green state.

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
   - Displays a 4-hour rolling chart (Demand vs Capacity).
   - Dynamically highlights **Red Zones** where the demand breaches the active rider capacity (A Delivery Collision).
   - Features tactical counters for "Total Demand", "Projected Riders", and "Breach Risk".

---

## ⚡ Intelligent Demand-Supply Balancing Engine
Predictive forecasting alone cannot prevent order blockages. To proactively resolve delivery collisions, the platform provides real-time demand-supply balancing levers. The motives and technical mechanics for these features are detailed below:

### 1. Supply-Side Incentives (Deploy Surge)
* **Motive:** When localized demand spikes rapidly (e.g., sudden rainfall or festival rushes), the quickest way to restore capacity is to boost local courier supply. Financial bonuses motivate offline gig-economy workers to log on immediately. However, payout values must be optimized; overpaying creates diminishing returns on capital, while underpaying fails to convert enough riders.
* **Technical and Mathematical Mechanics:**
  - **Endpoint:** `POST /api/v1/simulation/deploy-incentive`
  - **Behavioral S-Curve:** Employs a **Sigmoid Activation Function** to model log-on conversion:
    $$P(\text{login}) = \frac{1}{1 + e^{-k(x - x_0)}}$$
    - $x_0 = \text{₹40}$ (Inflection Point: exactly 50% conversion).
    - $k = 0.1$ (Steepness factor).
    - At ₹80, conversion reaches **98%** (diminishing returns). Below ₹40, conversion drops exponentially (e.g., ₹10 converts <5%). Converted riders transition from `INACTIVE` to `ONLINE` in PostgreSQL, boosting maximum delivery capacity.

### 2. Tactical Fleet Rebalancing (Smart Roster)
* **Motive:** Moving active riders between zones is an operational cost and risks causing secondary capacity deficits in donor zones. The platform needs an intelligent roster manager that identifies over-staffed zones (those with excess capacity headroom) and dynamically recommends moving high-skill riders to congested zones without tipping the donor zones into the red.
* **Technical and Mathematical Mechanics:**
  - **Endpoints:**
    - `GET /api/v1/simulation/riders` (Roster inspection by skill tier)
    - `POST /api/v1/simulation/draft-roster` (AI-Assisted recommendation engine)
    - `POST /api/v1/simulation/rebalance-riders` (Roster transaction executor)
  - **AI Recommendation Draft:** Calculates how many riders a neighboring safe zone can spare without turning red based on its active capacity parameters: `quota = math.floor(padding / single_rider_capacity)`.
  - **Tier-Prioritized Sorting:** Automatically prioritizes higher skill levels (`EXPERT` > `STANDARD` > `TRAINEE`) to ensure maximum capacity injection with the minimum number of worker relocations.
  - **Execution:** Updates target zones in `RiderState`. Subsequent client forecasts dynamically recalculate local capacity thresholds.

### 3. Binary Search Demand Steering (Auto-Steer)
* **Motive:** Completely locking delivery slots ruins customer experience and results in lost revenue. A gentler, revenue-optimal solution is to steer excess orders from congested slots into quieter future windows. Because demand changes non-linearly with time, traffic, and weather, the system must calculate exact capacity thresholds to avoid causing secondary bottlenecks downstream.
* **Technical and Mathematical Mechanics:**
  - **Endpoint:** `POST /api/v1/simulation/steer-demand`
  - **Non-Linear XGBoost Solver:**
    - **Step A (Identify Excess):** Runs a **Reverse Binary Search** on `Current_Load` at the peak hour to calculate the exact maximum load the model allows before capacity is breached. The excess is calculated as: `excess_orders = current_load - best_allowed_load`.
    - **Step B (Identify Headroom):** Runs a **Forward Binary Search** on future quieter hours to compute their exact remaining headroom: `true_headroom = max(0, max_allowed_load - current_load)`.
    - **Step C (Waterfall):** Cascade-reallocates the excess orders to future hours starting with the lowest base demand first, strictly ensuring no hour exceeds its non-linear capacity threshold.


---

## 🔄 CI/CD & MLOps Pipeline

To ensure the XGBoost model remains accurate over time, Slot Guard integrates a fully automated MLOps pipeline using **GitHub Actions** and **DagsHub**.

![CI/CD Pipeline](ci-cd-pipeline.png)

### How the Pipeline Works:
1. **GitHub Actions (Training Pipeline):** Triggered manually or by pushing updates, a cloud runner is spun up using `uv` for ultra-fast dependency installation. It executes the ML pipeline sequentially: preprocessing data, preparing features, training the XGBoost model, and evaluating its accuracy.
2. **DagsHub & MLflow (Model Registry):** During evaluation, metrics are logged to the DagsHub tracking server via MLflow. The newly serialized model artifact is then uploaded directly to the DagsHub Model Registry.
3. **Production Auto-Sync:** The production FastAPI backend is designed to pull the active model weights dynamically on boot. It targets the `@champion` alias on DagsHub. This means whenever a superior model finishes training in GitHub Actions, the backend instantly inherits the new "brain" upon its next deployment or restart without requiring code changes.

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
