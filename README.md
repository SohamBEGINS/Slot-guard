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

---

## 📚 Interview Preparation Resources
We have compiled comprehensive interview preparation files to help you master the tech stack and understand the system design of Slot Guard:
1. **[Tech Stack Guide](file:///c:/Users/Lenovo/Desktop/delivery_slot_prediction/interview_prep_tech_stack.md)**: Deep dive into FastAPI (ASGI, Event Loop blocking, Thread Pool offloading, Dependency Injection, Lifespan context) and React (sessionStorage client caching, Vite configuration, performance optimization).
2. **[Project & System Design Guide](file:///c:/Users/Lenovo/Desktop/delivery_slot_prediction/interview_prep_project.md)**: Detailed examination of delivery collisions, the Multi-Strategy capacity pattern, our dynamic Context-Aware Slot Booking Decay Model, Supabase PostgreSQL schema, and the MLOps pipeline (GitHub Actions + MLflow + DagsHub).

