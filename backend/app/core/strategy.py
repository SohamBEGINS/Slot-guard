from abc import ABC, abstractmethod

class CapacityStrategy(ABC):
    """
    Abstract interface for capacity calculation.
    """
    @abstractmethod
    def calculate_capacity(self, active_riders: int) -> int:
        pass

class StandardDayStrategy(CapacityStrategy):
    """
    Normal operating conditions.
    """
    def calculate_capacity(self, active_riders: int) -> int:
        # Standard efficiency: ~2 orders per hour per rider
        return int(active_riders * 2.0)

class SevereWeatherStrategy(CapacityStrategy):
    """
    Used when Weather Severity is high (e.g., Rain or Storm).
    Riders drive slower to maintain safety.
    """
    def calculate_capacity(self, active_riders: int) -> int:
        # Reduced efficiency: ~1.2 orders per hour per rider
        return int(active_riders * 1.2)

class FestivalStrategy(CapacityStrategy):
    """
    Used on festivals (e.g., Diwali). 
    Higher traffic, but much denser deliveries (multiple orders to the same apartment block).
    """
    def calculate_capacity(self, active_riders: int) -> int:
        # Increased efficiency due to dense batching: ~2.5 orders per hour
        return int(active_riders * 2.5)

from enum import Enum

class WeatherCondition(Enum):
    CLEAR = "CLEAR"
    WINDY = "WINDY"
    RAIN = "RAIN"
    STORM = "STORM"

def get_capacity_strategy(weather: WeatherCondition, is_festival: bool) -> CapacityStrategy:
    """
    A simple Factory method to pick the right strategy based on business rules,
    NOT based on ML feature floats!
    """
    if is_festival:
        return FestivalStrategy()
    elif weather in [WeatherCondition.RAIN, WeatherCondition.STORM]:
        return SevereWeatherStrategy()
    else:
        return StandardDayStrategy()
