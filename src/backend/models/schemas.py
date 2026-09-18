"""
Pydantic Schemas for ClearPath FastAPI Backend
"""

from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field

class GeoCoordinate(BaseModel):
    lat: float
    lng: float

class CommuterProfile(BaseModel):
    id: str = Field(default="commuter-arjun-01")
    name: str = Field(default="Arjun")
    persona: Literal["arjun", "rachel", "mdm_lim", "custom"] = "arjun"
    home_address: str = "Waterway Terraces II, Punggol Walk"
    home_coords: GeoCoordinate = GeoCoordinate(lat=1.4024, lng=103.9068)
    office_address: str = "Fusionopolis One, 1 Fusionopolis Way, one-north"
    office_coords: GeoCoordinate = GeoCoordinate(lat=1.2995, lng=103.7876)
    scheduled_departure_time: str = "08:30"
    flexible_window_minutes: int = 30
    notification_lead_time_minutes: int = 45
    bring_bicycle: bool = True
    prioritize_shelter: bool = True
    prioritize_low_crowd: bool = True
    motorcycle_mode: bool = False
    motorcycle_model: Optional[str] = "Yamaha XSR155 (Manual 6-Speed)"
    minimize_clutch_fatigue: bool = True

class RouteStep(BaseModel):
    id: str
    mode: Literal["cycle", "lrt", "mrt", "bus", "walk", "motorcycle", "shuttle"]
    instruction: str
    distance_meters: int
    duration_minutes: int
    coordinates: List[List[float]]
    is_sheltered: bool = False
    is_cycling_path: bool = False
    station_code: Optional[str] = None
    station_name: Optional[str] = None
    crowd_level: Optional[Literal["l", "m", "h", "NA"]] = None
    bus_service_no: Optional[str] = None
    bus_load: Optional[Literal["SEA", "SDA", "LSD"]] = None
    disruption_alert: Optional[str] = None
    free_mitigation: Optional[str] = None

class RouteOption(BaseModel):
    id: str
    title: str
    subtitle: str
    mode_summary: List[str]
    total_duration_minutes: int
    total_distance_km: float
    departure_time: str
    arrival_time: str
    crowd_score: Literal["Low", "Moderate", "High"]
    comfort_score: int
    sheltered_percentage: int
    cycling_distance_km: float
    steps: List[RouteStep]
    is_recommended: bool = False
    proactive_shift_minutes: int = 0
    is_alternative: bool = False
    disruption_avoided: bool = False
    traffic_stress_score: Optional[int] = None
    weather_risk: Optional[str] = "None"

class ProactiveNotificationPayload(BaseModel):
    id: str
    timestamp: str
    commute_date: str
    scheduled_time: str
    recommended_action: str
    reason: str
    severity: Literal["info", "warning", "alert"]
    time_shift_minutes: int
    new_departure_time: str
    original_route_id: str
    suggested_route_id: str
    disruption_summary: Optional[str] = None
    weather_summary: Optional[str] = None
    crowd_summary: Optional[str] = None
    free_mitigation_available: Optional[str] = None

class OfflineRouteCache(BaseModel):
    cached_at: str
    active_route: RouteOption
    profile: CommuterProfile
    offline_notes: List[str]
