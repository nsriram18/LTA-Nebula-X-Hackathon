"""Server-side route generation for the ClearPath frontend."""

from typing import Any, Dict, List

from models.schemas import CommuterProfile, RouteOption, RouteStep
from services.onemap_service import onemap_service


class RoutingService:
    @staticmethod
    def _arrival(departure: str, duration: int) -> str:
        hours, minutes = (int(value) for value in departure.split(":"))
        total = hours * 60 + minutes + duration
        return f"{(total // 60) % 24:02d}:{total % 60:02d}"

    @staticmethod
    def _step(
        step_id: str,
        mode: str,
        instruction: str,
        distance: int,
        duration: int,
        coordinates: List[List[float]],
        **kwargs: Any,
    ) -> RouteStep:
        return RouteStep(
            id=step_id,
            mode=mode,
            instruction=instruction,
            distance_meters=distance,
            duration_minutes=duration,
            coordinates=coordinates,
            **kwargs,
        )

    async def generate_routes(
        self,
        profile: CommuterProfile,
        alerts: Dict[str, Any],
        weather: Dict[str, Any],
        crowd: Dict[str, str],
    ) -> List[RouteOption]:
        departure = profile.scheduled_departure_time
        raining = bool(weather.get("is_raining"))

        if profile.motorcycle_mode:
            return self._motorcycle_routes(departure, raining)

        disrupted = alerts.get("Status") == 2 and bool(alerts.get("AffectedSegments"))
        if disrupted:
            recommended = self._disruption_route(departure, alerts, raining)
        elif raining and weather.get("severity") == "Heavy Rain":
            recommended = self._rain_route(departure)
        else:
            recommended = await self._normal_route(profile, departure, crowd)

        return [recommended, self._off_peak_route(departure)]

    async def _normal_route(
        self,
        profile: CommuterProfile,
        departure: str,
        crowd: Dict[str, str],
    ) -> RouteOption:
        duration = 42
        distance_km = 25.4
        one_map = await onemap_service.get_route(
            profile.home_coords.lat,
            profile.home_coords.lng,
            profile.office_coords.lat,
            profile.office_coords.lng,
            "pt",
        )
        summary = one_map.get("route_summary", {}) if isinstance(one_map, dict) else {}
        live_seconds = summary.get("total_time")
        live_distance = summary.get("total_distance")
        if isinstance(live_seconds, (int, float)) and 1500 <= live_seconds <= 7200:
            duration = round(live_seconds / 60)
        if isinstance(live_distance, (int, float)) and 1000 <= live_distance <= 100000:
            distance_km = round(live_distance / 1000, 1)

        crowd_level = crowd.get("PE7", "m")
        return RouteOption(
            id="route-arjun-signature",
            title="Multi-Modal Park Connector Route",
            subtitle="Scenic Cycle via Punggol Waterway + MRT Direct",
            mode_summary=["cycle", "lrt", "mrt", "walk"],
            total_duration_minutes=duration,
            total_distance_km=distance_km,
            departure_time=departure,
            arrival_time=self._arrival(departure, duration),
            crowd_score="High" if crowd_level == "h" else "Moderate",
            comfort_score=88,
            sheltered_percentage=74,
            cycling_distance_km=2.1,
            is_recommended=True,
            steps=[
                self._step(
                    "sig-step-1",
                    "cycle",
                    "Cycle on Punggol CyclingPath along Sungei Punggol Waterway to Damai LRT (PE7)",
                    950,
                    5,
                    [[1.4024, 103.9068], [1.4038, 103.9082], [1.4052, 103.9085]],
                    is_cycling_path=True,
                ),
                self._step(
                    "sig-step-2",
                    "lrt",
                    "Take Punggol LRT East Loop from Damai (PE7) to Punggol Town Centre",
                    1100,
                    3,
                    [[1.4052, 103.9085], [1.4048, 103.9022]],
                    station_code="PE7",
                    station_name="Damai LRT",
                    crowd_level=crowd_level,
                ),
                self._step(
                    "sig-step-3",
                    "mrt",
                    "Board NEL to Serangoon, then Circle Line to one-north (CC23)",
                    23000,
                    max(20, duration - 12),
                    [[1.4048, 103.9022], [1.35, 103.8735], [1.3508, 103.8481], [1.2996, 103.7874]],
                    station_code="CC23",
                    station_name="one-north",
                    crowd_level=crowd.get("CC23", "m"),
                ),
                self._step(
                    "sig-step-4",
                    "walk",
                    "Walk along CoveredLinkWay Exit A to Fusionopolis One",
                    350,
                    4,
                    [[1.2996, 103.7874], [1.2995, 103.7876]],
                    is_sheltered=True,
                ),
            ],
        )

    def _disruption_route(
        self,
        departure: str,
        alerts: Dict[str, Any],
        raining: bool,
    ) -> RouteOption:
        segment = alerts.get("AffectedSegments", [{}])[0]
        free_bus = segment.get("FreePublicBus") or "Free public bus boarding active"
        shuttle = segment.get("FreeMRTShuttle") or "Free MRT Shuttle"
        duration = 44
        return RouteOption(
            id="route-mitigated-disruption",
            title="Mitigated Transit Route",
            subtitle="Bypasses Punggol LRT via Free MRT Shuttle & Direct Transit",
            mode_summary=["cycle", "shuttle", "mrt", "walk"],
            total_duration_minutes=duration,
            total_distance_km=24.8,
            departure_time=departure,
            arrival_time=self._arrival(departure, duration),
            crowd_score="Moderate",
            comfort_score=86,
            sheltered_percentage=82,
            cycling_distance_km=1.2,
            is_recommended=True,
            disruption_avoided=True,
            weather_risk="Moderate Rain" if raining else "None",
            steps=[
                self._step(
                    "disruption-step-1",
                    "cycle",
                    "Cycle via Punggol Waterway Connector to Punggol Bus Interchange",
                    1200,
                    6,
                    [[1.4024, 103.9068], [1.4038, 103.9082], [1.4048, 103.9022]],
                    is_cycling_path=True,
                ),
                self._step(
                    "disruption-step-2",
                    "shuttle",
                    f"Board {shuttle} to Serangoon / Circle Line",
                    11000,
                    18,
                    [[1.4048, 103.9022], [1.385, 103.885], [1.35, 103.8735]],
                    free_mitigation="FreeMRTShuttle",
                    disruption_alert=f"LTA mitigation active: {free_bus}",
                ),
                self._step(
                    "disruption-step-3",
                    "mrt",
                    "Take Circle Line towards HarbourFront to one-north (CC23)",
                    12100,
                    16,
                    [[1.35, 103.8735], [1.332, 103.815], [1.2996, 103.7874]],
                    station_code="CC23",
                    station_name="one-north",
                    crowd_level="m",
                ),
                self._step(
                    "disruption-step-4",
                    "walk",
                    "Walk through CoveredLinkWay Exit A to Fusionopolis One",
                    350,
                    4,
                    [[1.2996, 103.7874], [1.2995, 103.7876]],
                    is_sheltered=True,
                ),
            ],
        )

    def _rain_route(self, departure: str) -> RouteOption:
        duration = 48
        return RouteOption(
            id="route-rain-sheltered",
            title="Sheltered Rain-Shield Route",
            subtitle="Covered walkway and feeder bus to avoid the downpour",
            mode_summary=["walk", "bus", "mrt", "walk"],
            total_duration_minutes=duration,
            total_distance_km=25.1,
            departure_time=departure,
            arrival_time=self._arrival(departure, duration),
            crowd_score="Moderate",
            comfort_score=92,
            sheltered_percentage=94,
            cycling_distance_km=0,
            is_recommended=True,
            weather_risk="Heavy Rain",
            steps=[
                self._step(
                    "rain-step-1",
                    "walk",
                    "Walk along CoveredLinkWay to Opp Damai Stn bus stop (65309)",
                    280,
                    3,
                    [[1.4024, 103.9068], [1.4052, 103.9085]],
                    is_sheltered=True,
                ),
                self._step(
                    "rain-step-2",
                    "bus",
                    "Board Bus 84 / 382G to Punggol Central Interchange",
                    1400,
                    5,
                    [[1.4052, 103.9085], [1.4048, 103.9022]],
                    bus_service_no="84",
                    bus_load="SEA",
                    bus_feature="WAB",
                    bus_type="DD",
                ),
                self._step(
                    "rain-step-3",
                    "mrt",
                    "Take NEL to Serangoon, transfer to Circle Line to one-north",
                    23100,
                    36,
                    [[1.4048, 103.9022], [1.35, 103.8735], [1.2996, 103.7874]],
                    station_code="NE17",
                    station_name="Punggol",
                    crowd_level="m",
                ),
                self._step(
                    "rain-step-4",
                    "walk",
                    "Walk via underground CoveredLinkWay into Fusionopolis One",
                    320,
                    4,
                    [[1.2996, 103.7874], [1.2995, 103.7876]],
                    is_sheltered=True,
                ),
            ],
        )

    def _off_peak_route(self, departure: str) -> RouteOption:
        shifted = self._arrival(departure, 20)
        duration = 39
        return RouteOption(
            id="route-proactive-offpeak",
            title="Comfort-Max Shift (+20 Min)",
            subtitle=f"Depart at {shifted} to miss peak platform crowding",
            mode_summary=["cycle", "bus", "mrt", "walk"],
            total_duration_minutes=duration,
            total_distance_km=24.5,
            departure_time=shifted,
            arrival_time=self._arrival(shifted, duration),
            crowd_score="Low",
            comfort_score=96,
            sheltered_percentage=86,
            cycling_distance_km=1.5,
            proactive_shift_minutes=20,
            is_alternative=True,
            steps=[
                self._step(
                    "shift-step-1",
                    "cycle",
                    "Cycle via Waterway CyclingPath to Punggol Central Interchange",
                    1500,
                    7,
                    [[1.4024, 103.9068], [1.4048, 103.9022]],
                    is_cycling_path=True,
                ),
                self._step(
                    "shift-step-2",
                    "bus",
                    "Board Bus 85 with seats available",
                    6200,
                    12,
                    [[1.4048, 103.9022], [1.4173, 103.8329]],
                    bus_service_no="85",
                    bus_load="SEA",
                    bus_feature="WAB",
                    bus_type="DD",
                ),
                self._step(
                    "shift-step-3",
                    "mrt",
                    "Continue to one-north during the lower-crowd window",
                    16500,
                    16,
                    [[1.4173, 103.8329], [1.3508, 103.8481], [1.2996, 103.7874]],
                    station_code="CC23",
                    station_name="one-north",
                    crowd_level="l",
                ),
                self._step(
                    "shift-step-4",
                    "walk",
                    "CoveredLinkWay to Fusionopolis",
                    300,
                    4,
                    [[1.2996, 103.7874], [1.2995, 103.7876]],
                    is_sheltered=True,
                ),
            ],
        )

    def _motorcycle_routes(self, departure: str, raining: bool) -> List[RouteOption]:
        smooth_duration = 32
        pie_duration = 45
        smooth = RouteOption(
            id="moto-route-smooth",
            title="Free-Flow Viaduct Bypass (Recommended)",
            subtitle="Via Bartley Viaduct & Lornie Highway — minimized clutch friction",
            mode_summary=["motorcycle"],
            total_duration_minutes=smooth_duration,
            total_distance_km=23.2,
            departure_time=departure,
            arrival_time=self._arrival(departure, smooth_duration),
            crowd_score="Low",
            comfort_score=94,
            sheltered_percentage=12,
            cycling_distance_km=0,
            traffic_stress_score=18,
            is_recommended=True,
            weather_risk="Moderate Rain" if raining else "None",
            steps=[
                self._step(
                    "moto-1",
                    "motorcycle",
                    "Take TPE Westbound towards Bartley Viaduct",
                    2800,
                    4,
                    [[1.4024, 103.9068], [1.385, 103.88]],
                ),
                self._step(
                    "moto-2",
                    "motorcycle",
                    "Use Bartley Viaduct and Lornie Highway for continuous flow",
                    12500,
                    14,
                    [[1.385, 103.88], [1.338, 103.829], [1.325, 103.815]],
                ),
                self._step(
                    "moto-3",
                    "motorcycle",
                    "Follow Portsdown Road into Fusionopolis parking",
                    7900,
                    14,
                    [[1.325, 103.815], [1.2995, 103.7876]],
                ),
            ],
        )
        pie = RouteOption(
            id="moto-route-pie-heavy",
            title="Pan Island Expressway (PIE) Standard",
            subtitle="Speed Band 1 near Adam Road — severe clutch load",
            mode_summary=["motorcycle"],
            total_duration_minutes=pie_duration,
            total_distance_km=25.8,
            departure_time=departure,
            arrival_time=self._arrival(departure, pie_duration),
            crowd_score="High",
            comfort_score=42,
            sheltered_percentage=8,
            cycling_distance_km=0,
            traffic_stress_score=88,
            is_alternative=True,
            weather_risk="Heavy Rain" if raining else "None",
            steps=[
                self._step(
                    "moto-pie-1",
                    "motorcycle",
                    "TPE to CTE Southbound",
                    8000,
                    12,
                    [[1.4024, 103.9068], [1.348, 103.861]],
                ),
                self._step(
                    "moto-pie-2",
                    "motorcycle",
                    "PIE Westbound stop-and-go bottleneck",
                    9800,
                    21,
                    [[1.348, 103.861], [1.328, 103.815]],
                ),
                self._step(
                    "moto-pie-3",
                    "motorcycle",
                    "Continue via Clementi Road to one-north",
                    8000,
                    12,
                    [[1.328, 103.815], [1.2995, 103.7876]],
                ),
            ],
        )
        return [smooth, pie]


routing_service = RoutingService()
