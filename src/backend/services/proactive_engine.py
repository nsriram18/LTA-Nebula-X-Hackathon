"""
Proactive Engine Service (Python/FastAPI)
Background task that orchestrates LTA DataMall & data.gov.sg 45 minutes prior to scheduled departure.
Generates actionable notifications with departure shifts or alternative mitigations.
"""

import asyncio
from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo
from models.schemas import (
    CommuterProfile,
    MetricEvidence,
    ProactiveEvaluationResponse,
    ProactiveNotificationPayload,
)
from services.lta_service import lta_service
from services.routing_service import routing_service
from services.weather_service import weather_service

class ProactiveDecisionEngine:
    @staticmethod
    def _notification_evidence(profile: CommuterProfile, kind: str, detail: str) -> dict[str, MetricEvidence]:
        return {
            "scheduledTime": MetricEvidence(source="Commuter profile", type="reference", detail="User-configured scheduled departure time."),
            "timeShiftMinutes": MetricEvidence(source="ClearPath decision rule", type=kind, detail=detail),
            "newDepartureTime": MetricEvidence(source="ClearPath calculation", type="derived", detail="Scheduled departure plus the displayed shift."),
        }
    async def evaluate_commute(
        self,
        profile: CommuterProfile,
        replay_disruption: bool = False,
        simulated_rain: bool = False,
        simulated_crowd: bool = False,
    ) -> ProactiveEvaluationResponse:
        scheduled = profile.scheduled_departure_time
        now = datetime.now(ZoneInfo("Asia/Singapore"))
        timestamp = now.strftime("%H:%M")
        commute_date = now.date().isoformat()
        departure_hour, departure_minute = (int(part) for part in scheduled.split(":"))
        shifted_total = departure_hour * 60 + departure_minute + 20
        shifted = f"{(shifted_total // 60) % 24:02d}:{shifted_total % 60:02d}"
        alerts, weather, crowd = await asyncio.gather(
            lta_service.get_train_service_alerts(replay_mode=replay_disruption),
            weather_service.check_punggol_cycling_rain(simulated_rain=simulated_rain),
            lta_service.get_station_crowd_forecast("NEL", scheduled),
        )
        if simulated_crowd:
            crowd.update({"PE7": "h", "NE17": "h"})
            crowd["_evidence"] = {
                "source": "ClearPath scenario control",
                "type": "simulation",
                "detail": "Judge-controlled high-crowd fixture; not a live LTA observation.",
            }

        has_disruption = alerts.get("Status") == 2 and len(alerts.get("AffectedSegments", [])) > 0
        has_heavy_rain = weather.get("is_raining") and weather.get("severity") == "Heavy Rain"
        routes = await routing_service.generate_routes(profile, alerts, weather, crowd)
        notification: Optional[ProactiveNotificationPayload] = None

        # Motorcycle Mode
        if profile.motorcycle_mode:
            if has_heavy_rain:
                notification = ProactiveNotificationPayload(
                    id="notif-moto-rain",
                    timestamp=timestamp,
                    commute_date=commute_date,
                    scheduled_time=scheduled,
                    severity="warning",
                    time_shift_minutes=0,
                    new_departure_time=scheduled,
                    recommended_action=f"Use the live low-stress motorcycle route to {profile.office_address}",
                    reason="The route was recalculated from the configured coordinates with wet-road risk weighting.",
                    original_route_id="moto-route-pie-heavy",
                    suggested_route_id="moto-route-smooth",
                    weather_summary="Rain cell over Central Expressway corridor.",
                    disruption_summary="SIMULATION: wet-road risk scenario is active.",
                    metric_evidence=self._notification_evidence(profile, "simulation", "No departure shift; rain is a judge-controlled simulation."),
                )
            else:
                notification = ProactiveNotificationPayload(
                    id="notif-moto-flow",
                    timestamp=timestamp,
                    commute_date=commute_date,
                    scheduled_time=scheduled,
                    severity="info",
                    time_shift_minutes=0,
                    new_departure_time=scheduled,
                    recommended_action=f"Use the live motorcycle route to {profile.office_address}",
                    reason="OneMap geometry was recalculated from the configured origin and destination.",
                    original_route_id="moto-route-pie-heavy",
                    suggested_route_id="moto-route-smooth",
                    metric_evidence=self._notification_evidence(profile, "derived", "No departure shift is applied."),
                )

        # Train Disruption
        elif has_disruption:
            seg = alerts["AffectedSegments"][0]
            mitigation = seg.get("FreeMRTShuttle") or seg.get("FreePublicBus") or "Free bridging transit"
            notification = ProactiveNotificationPayload(
                id="notif-disruption",
                timestamp=timestamp,
                commute_date=commute_date,
                scheduled_time=scheduled,
                severity="alert",
                time_shift_minutes=0,
                new_departure_time=scheduled,
                recommended_action=f"Use the disruption-aware route to {profile.office_address}",
                reason=f"{seg.get('Line')} signalling fault at {seg.get('Stations')}. LTA activated {mitigation}.",
                original_route_id="route-arjun-signature",
                suggested_route_id="route-mitigated-disruption",
                disruption_summary=alerts.get("Message", [{}])[0].get("Content"),
                free_mitigation_available=mitigation,
                metric_evidence=self._notification_evidence(profile, "simulation" if replay_disruption else "live_api", "No time shift; response uses the disruption evidence attached to the alert."),
            )

        # Heavy Rain on cycling leg
        elif has_heavy_rain:
            notification = ProactiveNotificationPayload(
                id="notif-rain",
                timestamp=timestamp,
                commute_date=commute_date,
                scheduled_time=scheduled,
                severity="warning",
                time_shift_minutes=20,
                new_departure_time=shifted,
                recommended_action=f"Use the rain-aware route from {profile.home_address}; optional +20 minute shift is within the profile's flexibility window",
                reason="Heavy rain is active. The +20 minute option is a user-flexibility scenario, not a weather-clearance forecast.",
                original_route_id="route-arjun-signature",
                suggested_route_id="route-rain-sheltered",
                weather_summary=weather.get("advisory"),
                metric_evidence=self._notification_evidence(profile, "simulation" if simulated_rain else "derived", "Optional 20-minute shift is a scenario within the configured flexibility window."),
            )

        elif crowd.get("PE7") == "h" or crowd.get("NE17") == "h":
            notification = ProactiveNotificationPayload(
                id="notif-crowd",
                timestamp=timestamp,
                commute_date=commute_date,
                scheduled_time=scheduled,
                severity="info",
                time_shift_minutes=20,
                new_departure_time=shifted,
                recommended_action=f"Shift departure by +20 min to {shifted}",
                reason=f"The available crowd evidence indicates a high platform load around {scheduled}. The +20 minute alternative has not been re-forecast.",
                original_route_id="route-arjun-signature",
                suggested_route_id="route-proactive-offpeak",
                crowd_summary=f"High crowd evidence applies to the scheduled route from {profile.home_address}; shifted-route crowd is unverified.",
                metric_evidence=self._notification_evidence(profile, "simulation" if simulated_crowd else "derived", "Optional 20-minute shift is within the configured flexibility window; crowd at the shifted time is not asserted."),
            )

        return ProactiveEvaluationResponse(
            payload=notification,
            routes=routes,
            active_alerts=has_disruption,
            weather_alert=bool(weather.get("is_raining")),
            profile=profile,
        )

proactive_engine = ProactiveDecisionEngine()
