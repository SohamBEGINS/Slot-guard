from pydantic import BaseModel, Field
from datetime import datetime
from app.core.strategy import WeatherCondition


class CheckoutSlotRequest(BaseModel):
    """
    The exact JSON payload expected from the React Frontend
    when a user clicks to check slot availability.
    Now includes run_id to scope the load query to the active simulation.
    """
    run_id: str = Field(..., description="The active simulation run UUID")
    zone_id: int = Field(..., description="The ID of the delivery zone")
    slot_time: datetime = Field(..., description="The requested delivery time")
    is_festival: bool = Field(default=False, description="Is it a festival day?")
    weather: WeatherCondition = Field(
        default=WeatherCondition.CLEAR,
        description="The current weather condition from the simulation dropdown"
    )
    traffic: str = Field(default="LOW", description="Traffic level: LOW, MEDIUM, HIGH, GRIDLOCK")


class CheckoutSlotResponse(BaseModel):
    """
    The JSON response sent back to the React Frontend.
    """
    zone_id: int
    slot_time: datetime
    is_available: bool = Field(..., description="If false, Frontend should show slot as congested")
    predicted_demand: int | None = None
    live_capacity: int | None = None
    surge_fee_active: bool = False
    surge_fee_amount: float = 0.0


class SimulationInitRequest(BaseModel):
    """
    Payload sent from the SetupPage to initialize a new simulation run.
    fleet_deployment_pct controls how many of the pre-seeded riders go ONLINE (0.6 to 1.0).
    Orders are derived from dataset statistics — not user input.
    """
    run_name: str = Field(..., description="Auto-generated or admin-renamed label")
    target_time: datetime
    weather: str = Field(..., description="CLEAR, WINDY, RAIN, STORM")
    traffic: str = Field(..., description="LOW, MEDIUM, HIGH, GRIDLOCK")
    is_festival: bool
    fleet_deployment_pct: float = Field(default=0.75, ge=0.5, le=1.0, description="Fraction of riders to bring ONLINE per zone")
    created_by: str | None = Field(default=None, description="Username of the operator")
