from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.requests import CheckoutSlotRequest, CheckoutSlotResponse
from app.core.facade import SlotAvailabilityFacade

router = APIRouter()

@router.post("/evaluate-slot", response_model=CheckoutSlotResponse)
async def evaluate_delivery_slot(
    request: CheckoutSlotRequest, 
    db: Session = Depends(get_db)
):
    """
    Receives the JSON payload from the React Frontend.
    Passes it to the Facade Orchestrator.
    Returns the final Yes/No decision.
    """
    facade = SlotAvailabilityFacade(db)
    return await facade.evaluate_slot(request)
