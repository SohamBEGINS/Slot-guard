from pydantic import BaseModel, Field
from datetime import datetime
from app.core.strategy import WeatherCondition


class CheckoutSlotRequest(BaseModel):
    """
    The exact JSON payload expected from the React Frontend
    when a user clicks to check slot availability.
    """
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
    is_available: bool = Field(..., description="If false, Frontend should gray out this button")
    predicted_demand: int | None = None
    live_capacity: int | None = None


class SimulationInitRequest(BaseModel):
    """
    Payload sent from the SetupPage to initialize the simulation database state.
    """
    target_time: datetime
    weather: str = Field(..., description="CLEAR, WINDY, RAIN, STORM")
    traffic: str = Field(..., description="LOW, MEDIUM, HIGH, GRIDLOCK")
    is_festival: bool
    fleet_size: int = Field(..., description="Total riders to distribute across 8 zones")
    initial_orders: int = Field(..., description="Total orders to inject across 8 zones")
