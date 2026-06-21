from pydantic import BaseModel, Field
from datetime import datetime
from app.core.strategy import WeatherCondition

class CheckoutSlotRequest(BaseModel):
    """
    The exact JSON payload expected from the React Frontend
    when a user clicks to check slot availability.
    """
    zone_id: int = Field(..., description="The ID of the delivery zone")
    
    # We expect an ISO format string like "2024-10-25T20:00:00"
    slot_time: datetime = Field(..., description="The requested delivery time")
    
    # Simulation Parameters (From the Admin Dashboard sliders)
    is_festival: bool = Field(default=False, description="Is it a festival day?")
    weather: WeatherCondition = Field(
        default=WeatherCondition.CLEAR, 
        description="The current weather condition from the simulation dropdown"
    )

class CheckoutSlotResponse(BaseModel):
    """
    The JSON response sent back to the React Frontend.
    """
    zone_id: int
    slot_time: datetime
    is_available: bool = Field(..., description="If false, Frontend should gray out this button")
    
    # Optional debugging info for the Admin Dashboard to see WHY it was blocked
    predicted_demand: int | None = None
    live_capacity: int | None = None
