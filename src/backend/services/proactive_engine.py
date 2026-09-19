"""
Proactive Engine Service (Python/FastAPI)
Background task that orchestrates LTA DataMall & data.gov.sg 45 minutes prior to scheduled departure.
Generates actionable notifications with departure shifts or alternative mitigations.
"""

from typing import Dict, Any, Optional
from models.schemas import CommuterProfile, ProactiveNotificationPayload
from services.lta_service import lta_service
from services.weather_service import weather_service

class ProactiveDecisionEngine:
    async def evaluate_commute(
        self,
        profile: CommuterProfile,
        replay_disruption: bool = False,
        simulated_rain: bool = False,
    ) -> Optional[ProactiveNotificationPayload]:
        scheduled = profile.scheduled_departure_time
        alerts = await lta_service.get_train_service_alerts(replay_mode=replay_disruption)
        weather = await weather_service.check_punggol_cycling_rain(simulated_rain=simulated_rain)

        has_disruption = alerts.get("Status") == 2 and len(alerts.get("AffectedSegments", [])) > 0
        has_heavy_rain = weather.get("is_raining") and weather.get("severity") == "Heavy Rain"

        # Motorcycle Mode
        if profile.motorcycle_mode:
            if has_heavy_rain:
                return ProactiveNotificationPayload(
                    id="notif-moto-rain",
                    timestamp="07:45",
                    commute_date="2026-09-18",
                    scheduled_time=scheduled,
                    severity="warning",
                    time_shift_minutes=0,
                    new_departure_time=scheduled,
                    recommended_action="Reroute via Bartley Viaduct (Avoid PIE Stop-and-Go & Wet Line Slip Hazard)",
                    reason="PIE Westbound bottleneck has Speed Band 1 (12 km/h) stop-and-go with high wet surface risk.",
                    original_route_id="moto-route-pie-heavy",
                    suggested_route_id="moto-route-smooth",
                    weather_summary="Rain cell over Central Expressway corridor.",
                    disruption_summary="Saves >80 clutch engagements on Yamaha XSR155.",
                )
            return ProactiveNotificationPayload(
                id="notif-moto-flow",
                timestamp="07:45",
                commute_date="2026-09-18",
                scheduled_time=scheduled,
                severity="info",
                time_shift_minutes=0,
                new_departure_time=scheduled,
                recommended_action="Take Bartley Viaduct Flow Route to one-north",
                reason="Free-flow speed (Speed Band 6: 65 km/h) eliminates clutch fatigue on manual transmission.",
                original_route_id="moto-route-pie-heavy",
                suggested_route_id="moto-route-smooth",
            )

        # Train Disruption
        if has_disruption:
            seg = alerts["AffectedSegments"][0]
            mitigation = seg.get("FreeMRTShuttle") or seg.get("FreePublicBus") or "Free bridging transit"
            return ProactiveNotificationPayload(
                id="notif-disruption",
                timestamp="07:45",
                commute_date="2026-09-18",
                scheduled_time=scheduled,
                severity="alert",
                time_shift_minutes=0,
                new_departure_time=scheduled,
                recommended_action="Take Free MRT Shuttle from Punggol Interchange direct to Circle Line",
                reason=f"{seg.get('Line')} signalling fault at {seg.get('Stations')}. LTA activated {mitigation}.",
                original_route_id="route-arjun-signature",
                suggested_route_id="route-mitigated-disruption",
                disruption_summary=alerts.get("Message", [{}])[0].get("Content"),
                free_mitigation_available=mitigation,
            )

        # Heavy Rain on cycling leg
        if has_heavy_rain:
            return ProactiveNotificationPayload(
                id="notif-rain",
                timestamp="07:45",
                commute_date="2026-09-18",
                scheduled_time=scheduled,
                severity="warning",
                time_shift_minutes=20,
                new_departure_time="08:50",
                recommended_action="Shift departure to 08:50 or take CoveredLinkWay + Bus 84",
                reason="Heavy rain cell (18.4 mm/h) over Punggol Park Connector will pass in 20 minutes.",
                original_route_id="route-arjun-signature",
                suggested_route_id="route-rain-sheltered",
                weather_summary=weather.get("advisory"),
            )

        return None

proactive_engine = ProactiveDecisionEngine()
