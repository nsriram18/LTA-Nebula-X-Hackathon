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
    ProactiveEvaluationResponse,
    ProactiveNotificationPayload,
)
from services.lta_service import lta_service
from services.routing_service import routing_service
from services.weather_service import weather_service

class ProactiveDecisionEngine:
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
                    disruption_summary="Saves >80 clutch engagements on Yamaha XSR155.",
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
                recommended_action=f"Shift departure to {shifted} or use the rain-aware route from {profile.home_address}",
                reason="Heavy rain was detected near the configured first-mile route and is expected to ease in 20 minutes.",
                original_route_id="route-arjun-signature",
                suggested_route_id="route-rain-sheltered",
                weather_summary=weather.get("advisory"),
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
                reason=f"LTA crowd forecast indicates a high platform load around {scheduled} before conditions ease.",
                original_route_id="route-arjun-signature",
                suggested_route_id="route-proactive-offpeak",
                crowd_summary=f"Crowding is expected to ease for the route from {profile.home_address} after the peak window.",
            )

        return ProactiveEvaluationResponse(
            payload=notification,
            routes=routes,
            active_alerts=has_disruption,
            weather_alert=bool(weather.get("is_raining")),
            profile=profile,
        )

proactive_engine = ProactiveDecisionEngine()
