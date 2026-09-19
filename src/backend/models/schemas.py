"""
Pydantic Schemas for ClearPath FastAPI Backend
"""

from typing import Dict, List, Optional, Literal
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class APIModel(BaseModel):
    """Accept Python snake_case internally and expose camelCase to React."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )


class GeoCoordinate(APIModel):
    lat: float = Field(ge=1.13, le=1.48)
    lng: float = Field(ge=103.59, le=104.10)


class RouteRequest(APIModel):
    """Parameters required to calculate a route anywhere in Singapore."""

    origin: GeoCoordinate
    destination: GeoCoordinate
    origin_address: str = Field(default="Origin", min_length=1, max_length=160)
    destination_address: str = Field(default="Destination", min_length=1, max_length=160)
    departure_time: str = Field(default="08:30", pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    travel_mode: Literal[
        "transit", "bus", "rail", "walk", "cycle", "drive", "motorcycle"
    ] = "transit"
    max_walk_distance: int = Field(default=1000, ge=100, le=5000)
    num_itineraries: int = Field(default=2, ge=1, le=3)
    prioritize_shelter: bool = False
    prioritize_low_crowd: bool = False


class MetricEvidence(APIModel):
    source: str
    type: Literal["live_api", "derived", "simulation", "estimated_fallback", "cached", "reference"]
    detail: str
    observed_at: Optional[str] = None
    source_url: Optional[str] = None


class CommuterProfile(APIModel):
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
    preferred_travel_mode: Literal["transit", "bus", "rail", "walk", "cycle", "drive"] = "transit"
    motorcycle_mode: bool = False
    motorcycle_model: Optional[str] = "Yamaha XSR155 (Manual 6-Speed)"
    minimize_clutch_fatigue: bool = True

class RouteStep(APIModel):
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
    bus_feature: Optional[Literal["WAB", "NORMAL"]] = None
    bus_type: Optional[Literal["SD", "DD", "BD"]] = None
    disruption_alert: Optional[str] = None
    free_mitigation: Optional[str] = None
    metric_evidence: Dict[str, MetricEvidence] = Field(default_factory=dict)

class RouteOption(APIModel):
    id: str
    title: str
    subtitle: str
    mode_summary: List[str]
    total_duration_minutes: int
    total_distance_km: float
    departure_time: str
    arrival_time: str
    crowd_score: Literal["Low", "Moderate", "High", "Unavailable"]
    comfort_score: Optional[int] = None
    sheltered_percentage: Optional[int] = None
    cycling_distance_km: float
    steps: List[RouteStep]
    is_recommended: bool = False
    proactive_shift_minutes: int = 0
    is_alternative: bool = False
    disruption_avoided: bool = False
    traffic_stress_score: Optional[int] = None
    weather_risk: Optional[str] = "None"
    condition: Optional[Literal["baseline", "disruption", "rain", "crowd", "planned_event", "motorcycle"]] = None
    baseline_route_id: Optional[str] = None
    duration_delta_minutes: Optional[int] = None
    crowd_comparison: Optional[str] = None
    uncertainty_note: str = "OneMap supplies a point estimate; live journey-time variability is unavailable."
    provider: Literal["onemap", "estimated_fallback"]
    metric_evidence: Dict[str, MetricEvidence] = Field(default_factory=dict)


class RoutePlanResponse(APIModel):
    routes: List[RouteOption]
    provider: Literal["onemap", "fallback"]

class ProactiveNotificationPayload(APIModel):
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
    metric_evidence: Dict[str, MetricEvidence] = Field(default_factory=dict)


class PlannedEvent(APIModel):
    id: str
    category: Literal["road_work", "road_opening", "planned_bus_route"]
    title: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None
    detail: Optional[str] = None
    affects_journey: bool = False
    evidence: MetricEvidence

class OfflineRouteCache(APIModel):
    cached_at: str
    active_route: RouteOption
    profile: CommuterProfile
    offline_notes: List[str]


class ProactiveEvaluationResponse(APIModel):
    payload: Optional[ProactiveNotificationPayload] = None
    routes: List[RouteOption]
    active_alerts: bool
    weather_alert: bool
    profile: CommuterProfile
    planned_events: List[PlannedEvent] = Field(default_factory=list)


class ScheduledCheckResponse(APIModel):
    status: Literal["evaluated", "outside_window", "unauthorized"]
    commuter_id: str
    evaluated_at: str
    minutes_until_departure: int
    notification: Optional[ProactiveNotificationPayload] = None


class DeleteDataResponse(APIModel):
    status: Literal["deleted"]
    commuter_id: str


class ProfileSaveResponse(APIModel):
    status: Literal["success", "error"]
    profile: CommuterProfile


class OfflineCacheSaveResponse(APIModel):
    status: Literal["cached", "error"]
    cached_at: str
