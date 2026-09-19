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
        alerts, weather, crowd, shifted_crowd, planned_events = await asyncio.gather(
            lta_service.get_train_service_alerts(replay_mode=replay_disruption),
            weather_service.check_punggol_cycling_rain(simulated_rain=simulated_rain),
            lta_service.get_station_crowd_forecast("NEL", scheduled),
            lta_service.get_station_crowd_forecast("NEL", shifted),
            lta_service.get_planned_events(profile.home_address, profile.office_address),
        )
        if simulated_crowd:
            crowd.update({"PE7": "h", "NE17": "h"})
            crowd["_evidence"] = {
                "source": "ClearPath scenario control",
                "type": "simulation",
                "detail": "Judge-controlled high-crowd fixture; not a live LTA observation.",
            }
            shifted_crowd.update({"PE7": "m", "NE17": "m"})
            shifted_crowd["_evidence"] = {
                "source": "ClearPath scenario control",
                "type": "simulation",
                "detail": "Judge-controlled shifted-time crowd fixture; not a live LTA observation.",
            }

        reported_disruption = alerts.get("Status") == 2 and len(alerts.get("AffectedSegments", [])) > 0
        has_heavy_rain = weather.get("is_raining") and weather.get("severity") == "Heavy Rain"
        routes = await routing_service.generate_routes(
            profile, alerts, weather, crowd, shifted_crowd
        )
        has_disruption = reported_disruption and routing_service._alert_intersects_route(
            routes[0], profile, alerts
        )
        notification: Optional[ProactiveNotificationPayload] = None
        route_ids = {route.id for route in routes}

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
                    recommended_action="Consider transit or delay riding while heavy rain is active",
                    reason="OneMap provides road geometry but not motorcycle wet-grip or fatigue telemetry, so no safety saving is claimed.",
                    original_route_id="moto-route-smooth",
                    suggested_route_id="moto-route-smooth",
                    weather_summary=weather.get("advisory"),
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
                    original_route_id="moto-route-smooth",
                    suggested_route_id="moto-route-smooth",
                    metric_evidence=self._notification_evidence(profile, "derived", "No departure shift is applied."),
                )

        # Train Disruption
        elif has_disruption:
            seg = alerts["AffectedSegments"][0]
            mitigation = seg.get("FreeMRTShuttle") or seg.get("FreePublicBus") or "Free bridging transit"
            verified = "route-mitigated-disruption" in route_ids
            notification = ProactiveNotificationPayload(
                id="notif-disruption",
                timestamp=timestamp,
                commute_date=commute_date,
                scheduled_time=scheduled,
                severity="alert",
                time_shift_minutes=0,
                new_departure_time=scheduled,
                recommended_action=(f"Use the verified rail-free alternative to {profile.office_address}" if verified else "Check LTA guidance before starting this journey"),
                reason=(f"{seg.get('Line')} disruption affects {seg.get('Stations')}. A separate OneMap bus itinerary was calculated." if verified else f"{seg.get('Line')} disruption affects {seg.get('Stations')}, but a rail-free route could not be verified."),
                original_route_id="route-original",
                suggested_route_id="route-mitigated-disruption" if verified else "route-original",
                disruption_summary=alerts.get("Message", [{}])[0].get("Content"),
                free_mitigation_available=mitigation,
                metric_evidence=self._notification_evidence(profile, "simulation" if replay_disruption else "live_api", "No time shift; response uses the disruption evidence attached to the alert."),
            )

        # Heavy Rain on cycling leg
        elif has_heavy_rain:
            verified = "route-rain-sheltered" in route_ids
            notification = ProactiveNotificationPayload(
                id="notif-rain",
                timestamp=timestamp,
                commute_date=commute_date,
                scheduled_time=scheduled,
                severity="warning",
                time_shift_minutes=20,
                new_departure_time=shifted,
                recommended_action=("Use the recalculated no-cycle bus alternative" if verified else "Avoid cycling while heavy rain is active"),
                reason=("A separate OneMap request removed cycling. Sheltered coverage remains unmeasured." if verified else "Heavy rain is active, but a verified lower-exposure alternative is unavailable."),
                original_route_id="route-original",
                suggested_route_id="route-rain-sheltered" if verified else "route-original",
                weather_summary=weather.get("advisory"),
                metric_evidence=self._notification_evidence(profile, "simulation" if simulated_rain else "derived", "Optional 20-minute shift is a scenario within the configured flexibility window."),
            )

        elif crowd.get("PE7") == "h" or crowd.get("NE17") == "h":
            shifted_route = next((route for route in routes if route.id == "route-proactive-offpeak"), None)
            verified = bool(shifted_route and shifted_route.is_recommended)
            notification = ProactiveNotificationPayload(
                id="notif-crowd",
                timestamp=timestamp,
                commute_date=commute_date,
                scheduled_time=scheduled,
                severity="info",
                time_shift_minutes=20,
                new_departure_time=shifted,
                recommended_action=(f"Shift departure by +20 min to {shifted}" if verified else "Keep the original time until a lower-crowd slot is verified"),
                reason=(f"Crowd evidence improves from High at {scheduled} to {routing_service._crowd_score(shifted_crowd)} at {shifted}; OneMap was queried again." if verified else f"High crowd is reported at {scheduled}, but the shifted slot is not demonstrably better."),
                original_route_id="route-original",
                suggested_route_id="route-proactive-offpeak" if verified else "route-original",
                crowd_summary=f"{routing_service._crowd_score(crowd)} at {scheduled} → {routing_service._crowd_score(shifted_crowd)} at {shifted}.",
                metric_evidence=self._notification_evidence(profile, "simulation" if simulated_crowd else "derived", "The shift is recommended only when the second crowd query is better and a new OneMap itinerary exists."),
            )

        return ProactiveEvaluationResponse(
            payload=notification,
            routes=routes,
            active_alerts=has_disruption,
            weather_alert=bool(weather.get("is_raining")),
            profile=profile,
            planned_events=planned_events,
        )

proactive_engine = ProactiveDecisionEngine()
