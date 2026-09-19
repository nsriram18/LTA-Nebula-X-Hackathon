"""Parameter-driven route generation backed by Singapore OneMap."""

from __future__ import annotations

import math
from typing import Any, Dict, Iterable, List, Sequence, Tuple

from models.schemas import CommuterProfile, MetricEvidence, RouteOption, RouteRequest, RouteStep
from services.onemap_service import onemap_service


class RoutingService:
    ONEMAP_URL = "https://www.onemap.gov.sg/apidocs/routing"
    DATAMALL_URL = "https://datamall.lta.gov.sg/content/datamall/en/dynamic-data.html"

    @staticmethod
    def _evidence(source: str, kind: str, detail: str, source_url: str | None = None) -> MetricEvidence:
        return MetricEvidence(source=source, type=kind, detail=detail, source_url=source_url)

    @staticmethod
    def _arrival(departure: str, duration: int) -> str:
        hours, minutes = (int(value) for value in departure.split(":"))
        total = hours * 60 + minutes + duration
        return f"{(total // 60) % 24:02d}:{total % 60:02d}"

    @staticmethod
    def _decode_polyline(encoded: str, precision: int = 5) -> List[List[float]]:
        """Decode a Google-encoded polyline into [latitude, longitude] points."""
        if not encoded:
            return []

        coordinates: List[List[float]] = []
        latitude = longitude = index = 0
        factor = 10**precision
        try:
            while index < len(encoded):
                values: List[int] = []
                for _ in range(2):
                    result = shift = 0
                    while True:
                        byte = ord(encoded[index]) - 63
                        index += 1
                        result |= (byte & 0x1F) << shift
                        shift += 5
                        if byte < 0x20:
                            break
                    values.append(~(result >> 1) if result & 1 else result >> 1)
                latitude += values[0]
                longitude += values[1]
                coordinates.append([latitude / factor, longitude / factor])
        except (IndexError, TypeError, ValueError):
            return []
        return coordinates

    @staticmethod
    def _haversine_km(start: Sequence[float], end: Sequence[float]) -> float:
        lat1, lng1, lat2, lng2 = map(
            math.radians, [start[0], start[1], end[0], end[1]]
        )
        delta_lat = lat2 - lat1
        delta_lng = lng2 - lng1
        value = (
            math.sin(delta_lat / 2) ** 2
            + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lng / 2) ** 2
        )
        return 6371.0088 * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))

    @staticmethod
    def _interpolate(
        start: Sequence[float], end: Sequence[float], count: int = 8
    ) -> List[List[float]]:
        return [
            [
                round(start[0] + (end[0] - start[0]) * index / (count - 1), 6),
                round(start[1] + (end[1] - start[1]) * index / (count - 1), 6),
            ]
            for index in range(count)
        ]

    @staticmethod
    def _mode(raw_mode: str, requested_mode: str) -> str:
        normalized = (raw_mode or "").upper()
        if requested_mode in {"drive", "motorcycle"} or normalized in {"CAR", "DRIVE"}:
            return "motorcycle"
        if normalized in {"BICYCLE", "CYCLE"} or requested_mode == "cycle":
            return "cycle"
        if normalized == "BUS":
            return "bus"
        if normalized in {"SUBWAY", "RAIL", "TRAIN"}:
            return "mrt"
        if normalized in {"TRAM", "LRT"}:
            return "lrt"
        if normalized in {"WALK", "WALKING"}:
            return "walk"
        if requested_mode in {"transit", "rail"}:
            return "mrt"
        if requested_mode == "bus":
            return "bus"
        return "walk"

    @staticmethod
    def _crowd_score(crowd: Dict[str, str]) -> str:
        levels = {value for value in crowd.values() if isinstance(value, str)}
        if "h" in levels:
            return "High"
        if "m" in levels:
            return "Moderate"
        if "l" in levels:
            return "Low"
        return "Unavailable"

    @staticmethod
    def _safe_number(value: Any, default: float = 0) -> float:
        return float(value) if isinstance(value, (int, float)) else default

    @staticmethod
    def _coordinates_from_place(place: Any) -> List[float] | None:
        if not isinstance(place, dict):
            return None
        lat = place.get("lat")
        lng = place.get("lon", place.get("lng"))
        if isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
            return [float(lat), float(lng)]
        return None

    async def plan_route(
        self,
        request: RouteRequest,
        crowd: Dict[str, str] | None = None,
    ) -> Tuple[List[RouteOption], str]:
        """Call OneMap using request parameters and normalize its routes for React."""
        crowd = crowd or {}
        route_type = (
            "pt"
            if request.travel_mode in {"transit", "bus", "rail"}
            else request.travel_mode
        )
        if route_type == "motorcycle":
            route_type = "drive"

        payload = await onemap_service.get_route(
            request.origin.lat,
            request.origin.lng,
            request.destination.lat,
            request.destination.lng,
            route_type,
            departure_time=request.departure_time,
            mode=request.travel_mode if route_type == "pt" else "transit",
            max_walk_distance=request.max_walk_distance,
            num_itineraries=request.num_itineraries,
        )

        routes = (
            self._parse_public_transport(payload, request, crowd)
            if route_type == "pt"
            else self._parse_path_route(payload, request, crowd)
        )
        if routes:
            routes[0].is_recommended = True
            for route in routes[1:]:
                route.is_alternative = True
            return routes, "onemap"

        return [self._fallback_route(request, crowd)], "fallback"

    def _parse_public_transport(
        self,
        payload: Dict[str, Any],
        request: RouteRequest,
        crowd: Dict[str, str],
    ) -> List[RouteOption]:
        plan = payload.get("plan") if isinstance(payload, dict) else None
        itineraries = plan.get("itineraries", []) if isinstance(plan, dict) else []
        routes: List[RouteOption] = []

        for route_index, itinerary in enumerate(itineraries[: request.num_itineraries]):
            if not isinstance(itinerary, dict):
                continue
            steps: List[RouteStep] = []
            total_distance = 0.0
            for leg_index, leg in enumerate(itinerary.get("legs", [])):
                if not isinstance(leg, dict):
                    continue
                mode = self._mode(str(leg.get("mode", "WALK")), request.travel_mode)
                geometry = leg.get("legGeometry", {})
                encoded = geometry.get("points", "") if isinstance(geometry, dict) else ""
                coordinates = self._decode_polyline(encoded)
                start_point = self._coordinates_from_place(leg.get("from"))
                end_point = self._coordinates_from_place(leg.get("to"))
                if not coordinates:
                    coordinates = [point for point in (start_point, end_point) if point]
                if len(coordinates) < 2:
                    continue

                distance = round(self._safe_number(leg.get("distance")))
                duration_seconds = self._safe_number(leg.get("duration"))
                duration = max(1, round(duration_seconds / 60))
                total_distance += distance
                start_name = (leg.get("from") or {}).get("name", request.origin_address)
                end_name = (leg.get("to") or {}).get("name", request.destination_address)
                route_name = (
                    leg.get("routeLongName")
                    or leg.get("route")
                    or leg.get("agencyName")
                )
                if mode in {"bus", "mrt", "lrt"} and route_name:
                    instruction = f"Take {route_name} from {start_name} to {end_name}"
                else:
                    instruction = f"{mode.title()} from {start_name} to {end_name}"

                steps.append(
                    RouteStep(
                        id=f"onemap-{route_index + 1}-leg-{leg_index + 1}",
                        mode=mode,
                        instruction=instruction,
                        distance_meters=max(0, distance),
                        duration_minutes=duration,
                        coordinates=coordinates,
                        is_sheltered=False,
                        is_cycling_path=False,
                        station_name=str(end_name) if mode in {"mrt", "lrt"} else None,
                        crowd_level=self._representative_crowd(crowd)
                        if mode in {"mrt", "lrt"}
                        else None,
                        bus_service_no=str(leg.get("route"))
                        if mode == "bus" and leg.get("route")
                        else None,
                        metric_evidence={
                            "durationMinutes": self._evidence("OneMap Routing API", "live_api", "Leg duration returned by OneMap.", self.ONEMAP_URL),
                            "distanceMeters": self._evidence("OneMap Routing API", "live_api", "Leg distance returned by OneMap.", self.ONEMAP_URL),
                            "coordinates": self._evidence("OneMap Routing API", "live_api", "Decoded OneMap leg geometry.", self.ONEMAP_URL),
                            **({"crowdLevel": self._crowd_evidence(crowd)} if mode in {"mrt", "lrt"} else {}),
                            **({"busServiceNo": self._evidence("OneMap Routing API", "live_api", "Bus service identifier returned for this leg.", self.ONEMAP_URL)} if mode == "bus" and leg.get("route") else {}),
                        },
                    )
                )

            if not steps:
                continue

            duration_seconds = self._safe_number(itinerary.get("duration"))
            duration = (
                max(1, round(duration_seconds / 60))
                if duration_seconds
                else sum(step.duration_minutes for step in steps)
            )
            if not total_distance:
                total_distance = sum(step.distance_meters for step in steps)
            mode_summary = list(dict.fromkeys(step.mode for step in steps))
            walk_distance = sum(
                step.distance_meters for step in steps if step.mode == "walk"
            )
            cycle_distance = sum(
                step.distance_meters for step in steps if step.mode == "cycle"
            )
            routes.append(
                RouteOption(
                    id=f"route-onemap-{route_index + 1}",
                    title="OneMap Public Transport Route"
                    if route_index == 0
                    else f"OneMap Alternative {route_index + 1}",
                    subtitle=f"{request.origin_address} → {request.destination_address}",
                    mode_summary=mode_summary,
                    total_duration_minutes=duration,
                    total_distance_km=round(total_distance / 1000, 1),
                    departure_time=request.departure_time,
                    arrival_time=self._arrival(request.departure_time, duration),
                    crowd_score=self._crowd_score(crowd),
                    comfort_score=None,
                    sheltered_percentage=None,
                    cycling_distance_km=round(cycle_distance / 1000, 1),
                    steps=steps,
                    provider="onemap",
                    metric_evidence={
                        "totalDurationMinutes": self._evidence("OneMap Routing API", "live_api", "Itinerary duration returned by OneMap.", self.ONEMAP_URL),
                        "totalDistanceKm": self._evidence("OneMap Routing API", "live_api", "Sum of OneMap leg distances, converted from metres to kilometres.", self.ONEMAP_URL),
                        "departureTime": self._evidence("Commuter profile", "reference", "User-configured scheduled departure time."),
                        "arrivalTime": self._evidence("ClearPath calculation", "derived", "Departure time plus OneMap itinerary duration."),
                        "crowdScore": self._crowd_evidence(crowd),
                        "shelteredPercentage": self._evidence("Unavailable", "reference", "OneMap does not return route-level sheltered coverage; no percentage is asserted."),
                        "cyclingDistanceKm": self._evidence("OneMap Routing API", "derived", "Sum of cycling-leg distances returned by OneMap.", self.ONEMAP_URL),
                    },
                )
            )
        return routes

    def _parse_path_route(
        self,
        payload: Dict[str, Any],
        request: RouteRequest,
        crowd: Dict[str, str],
    ) -> List[RouteOption]:
        summary = payload.get("route_summary") if isinstance(payload, dict) else None
        if not isinstance(summary, dict):
            return []
        duration_seconds = self._safe_number(summary.get("total_time"))
        distance = self._safe_number(summary.get("total_distance"))
        if duration_seconds <= 0 or distance <= 0:
            return []

        coordinates = self._decode_polyline(str(payload.get("route_geometry", "")))
        if len(coordinates) < 2:
            coordinates = self._interpolate(
                [request.origin.lat, request.origin.lng],
                [request.destination.lat, request.destination.lng],
            )
        instructions = payload.get("route_instructions", [])
        instruction_text = "Follow the OneMap route"
        if isinstance(instructions, list):
            descriptions = [
                item[9]
                for item in instructions
                if isinstance(item, list) and len(item) > 9 and item[9]
            ]
            if descriptions:
                instruction_text = "; then ".join(descriptions[:3])

        mode = self._mode(request.travel_mode, request.travel_mode)
        duration = max(1, round(duration_seconds / 60))
        title_by_mode = {
            "walk": "OneMap Walking Route",
            "cycle": "OneMap Cycling Route",
            "drive": "OneMap Driving Route",
            "motorcycle": "OneMap Motorcycle Route",
        }
        return [
            RouteOption(
                id="route-onemap-primary",
                title=title_by_mode.get(request.travel_mode, "OneMap Route"),
                subtitle=f"{request.origin_address} → {request.destination_address}",
                mode_summary=[mode],
                total_duration_minutes=duration,
                total_distance_km=round(distance / 1000, 1),
                departure_time=request.departure_time,
                arrival_time=self._arrival(request.departure_time, duration),
                crowd_score=self._crowd_score(crowd),
                comfort_score=None,
                sheltered_percentage=None,
                cycling_distance_km=round(distance / 1000, 1) if mode == "cycle" else 0,
                steps=[
                    RouteStep(
                        id="onemap-path-1",
                        mode=mode,
                        instruction=instruction_text,
                        distance_meters=round(distance),
                        duration_minutes=duration,
                        coordinates=coordinates,
                        is_sheltered=False,
                        is_cycling_path=False,
                        metric_evidence={
                            "durationMinutes": self._evidence("OneMap Routing API", "live_api", "Route duration returned by OneMap.", self.ONEMAP_URL),
                            "distanceMeters": self._evidence("OneMap Routing API", "live_api", "Route distance returned by OneMap.", self.ONEMAP_URL),
                            "coordinates": self._evidence("OneMap Routing API", "live_api", "Decoded OneMap route geometry.", self.ONEMAP_URL),
                        },
                    )
                ],
                provider="onemap",
                metric_evidence={
                    "totalDurationMinutes": self._evidence("OneMap Routing API", "live_api", "Route duration returned by OneMap.", self.ONEMAP_URL),
                    "totalDistanceKm": self._evidence("OneMap Routing API", "live_api", "Route distance returned by OneMap and converted to kilometres.", self.ONEMAP_URL),
                    "departureTime": self._evidence("Commuter profile", "reference", "User-configured scheduled departure time."),
                    "arrivalTime": self._evidence("ClearPath calculation", "derived", "Departure time plus OneMap duration."),
                    "crowdScore": self._crowd_evidence(crowd),
                    "shelteredPercentage": self._evidence("Unavailable", "reference", "The routing response contains no sheltered-coverage measurement."),
                    "cyclingDistanceKm": self._evidence("OneMap Routing API", "derived", "Cycling route distance returned by OneMap.", self.ONEMAP_URL),
                },
            )
        ]

    def _fallback_route(
        self, request: RouteRequest, crowd: Dict[str, str]
    ) -> RouteOption:
        start = [request.origin.lat, request.origin.lng]
        end = [request.destination.lat, request.destination.lng]
        straight_km = self._haversine_km(start, end)
        mode = self._mode(request.travel_mode, request.travel_mode)
        distance_km = max(0.1, straight_km * 1.22)
        speed = {
            "walk": 4.8,
            "cycle": 15.0,
            "motorcycle": 34.0,
            "bus": 23.0,
            "mrt": 28.0,
        }.get(mode, 25.0)
        transfer_minutes = 8 if request.travel_mode in {"transit", "bus", "rail"} else 0
        duration = max(1, round(distance_km / speed * 60 + transfer_minutes))
        return RouteOption(
            id="route-fallback-primary",
            title="Estimated Fallback Route",
            subtitle=f"{request.origin_address} → {request.destination_address} (OneMap temporarily unavailable)",
            mode_summary=[mode],
            total_duration_minutes=duration,
            total_distance_km=round(distance_km, 1),
            departure_time=request.departure_time,
            arrival_time=self._arrival(request.departure_time, duration),
            crowd_score=self._crowd_score(crowd),
            comfort_score=None,
            sheltered_percentage=None,
            cycling_distance_km=round(distance_km, 1) if mode == "cycle" else 0,
            is_recommended=True,
            steps=[
                RouteStep(
                    id="fallback-step-1",
                    mode=mode,
                    instruction=f"Travel from {request.origin_address} to {request.destination_address}",
                    distance_meters=round(distance_km * 1000),
                    duration_minutes=duration,
                    coordinates=self._interpolate(start, end),
                    is_sheltered=False,
                    is_cycling_path=False,
                    metric_evidence={
                        "durationMinutes": self._evidence("ClearPath fallback formula", "estimated_fallback", f"Estimated distance divided by assumed {speed:.1f} km/h, plus {transfer_minutes} transfer minutes."),
                        "distanceMeters": self._evidence("ClearPath fallback formula", "estimated_fallback", "Haversine distance multiplied by 1.22."),
                        "coordinates": self._evidence("ClearPath interpolation", "estimated_fallback", "Straight-line points between the submitted coordinates; not turn-by-turn geometry."),
                    },
                )
            ],
            provider="estimated_fallback",
            metric_evidence={
                "totalDurationMinutes": self._evidence("ClearPath fallback formula", "estimated_fallback", f"Estimated distance divided by assumed {speed:.1f} km/h, plus {transfer_minutes} transfer minutes."),
                "totalDistanceKm": self._evidence("ClearPath fallback formula", "estimated_fallback", "Haversine distance multiplied by 1.22."),
                "departureTime": self._evidence("Commuter profile", "reference", "User-configured scheduled departure time."),
                "arrivalTime": self._evidence("ClearPath calculation", "derived", "Departure time plus estimated duration."),
                "crowdScore": self._crowd_evidence(crowd),
                "shelteredPercentage": self._evidence("Unavailable", "reference", "No sheltered-coverage measurement is available for an estimated route."),
                "cyclingDistanceKm": self._evidence("ClearPath fallback formula", "estimated_fallback", "Equals estimated route distance only in cycling mode."),
            },
        )

    @staticmethod
    def _representative_crowd(crowd: Dict[str, str]) -> str:
        values = {value for value in crowd.values() if isinstance(value, str)}
        return "h" if "h" in values else "m" if "m" in values else "l" if "l" in values else "NA"

    def _crowd_evidence(self, crowd: Dict[str, str]) -> MetricEvidence:
        meta = crowd.get("_evidence")
        if isinstance(meta, dict):
            return MetricEvidence(**meta)
        if any(value in {"l", "m", "h"} for value in crowd.values() if isinstance(value, str)):
            return self._evidence("LTA DataMall PCDForecast", "live_api", "Aggregated from station crowd levels supplied to routing.", self.DATAMALL_URL)
        return self._evidence("Unavailable", "reference", "No station crowd observation was available.")

    @staticmethod
    def _set_recommended(routes: Iterable[RouteOption], selected_id: str) -> None:
        for route in routes:
            route.is_recommended = route.id == selected_id
            route.is_alternative = route.id != selected_id

    async def generate_routes(
        self,
        profile: CommuterProfile,
        alerts: Dict[str, Any],
        weather: Dict[str, Any],
        crowd: Dict[str, str],
    ) -> List[RouteOption]:
        """Plan from profile parameters, then apply proactive scenario annotations."""
        request = RouteRequest(
            origin=profile.home_coords,
            destination=profile.office_coords,
            origin_address=profile.home_address,
            destination_address=profile.office_address,
            departure_time=profile.scheduled_departure_time,
            travel_mode="motorcycle"
            if profile.motorcycle_mode
            else profile.preferred_travel_mode,
            max_walk_distance=600 if profile.prioritize_shelter else 1500,
            prioritize_shelter=profile.prioritize_shelter,
            prioritize_low_crowd=profile.prioritize_low_crowd,
            num_itineraries=2,
        )
        routes, _ = await self.plan_route(request, crowd)
        primary = routes[0]
        raining = bool(weather.get("is_raining"))
        disrupted = alerts.get("Status") == 2 and bool(alerts.get("AffectedSegments"))

        if profile.motorcycle_mode:
            primary.id = "moto-route-smooth"
            primary.title = "Live Motorcycle Route"
            primary.traffic_stress_score = None
            primary.weather_risk = "Moderate Rain" if raining else "None"
            return routes

        primary.id = "route-live-primary"
        primary.title = "Live OneMap Commute"

        if disrupted:
            segment = alerts.get("AffectedSegments", [{}])[0]
            mitigation = segment.get("FreeMRTShuttle") or segment.get("FreePublicBus")
            primary.id = "route-mitigated-disruption"
            primary.title = "Live Disruption-Aware Route"
            primary.subtitle = (
                f"Avoids affected service: {segment.get('Stations', 'reported segment')}"
            )
            primary.disruption_avoided = True
            if primary.steps:
                primary.steps[0].disruption_alert = (
                    mitigation or "LTA mitigation service is active"
                )
                primary.steps[0].free_mitigation = (
                    "FreeMRTShuttle"
                    if segment.get("FreeMRTShuttle")
                    else "FreePublicBus"
                )
        elif raining and weather.get("severity") == "Heavy Rain":
            primary.id = "route-rain-sheltered"
            primary.title = "Rain-Aware Live Route"
            primary.weather_risk = "Heavy Rain"

        if profile.flexible_window_minutes > 0:
            shift = min(20, profile.flexible_window_minutes)
            off_peak = primary.model_copy(deep=True)
            off_peak.id = "route-proactive-offpeak"
            off_peak.title = f"Flexible Departure (+{shift} Min)"
            off_peak.departure_time = self._arrival(
                profile.scheduled_departure_time, shift
            )
            off_peak.arrival_time = self._arrival(
                off_peak.departure_time, off_peak.total_duration_minutes
            )
            off_peak.proactive_shift_minutes = shift
            off_peak.metric_evidence["departureTime"] = self._evidence("ClearPath scenario", "derived", f"Adds the profile's allowed {shift}-minute flexible shift to the scheduled time.")
            off_peak.metric_evidence["arrivalTime"] = self._evidence("ClearPath calculation", "derived", "Shifted departure time plus the same route duration; traffic was not re-queried.")
            off_peak.is_recommended = False
            off_peak.is_alternative = True
            routes.append(off_peak)

            if (
                profile.prioritize_low_crowd
                and self._crowd_score(crowd) == "High"
                and not disrupted
                and not raining
            ):
                self._set_recommended(routes, off_peak.id)

        return routes


routing_service = RoutingService()
