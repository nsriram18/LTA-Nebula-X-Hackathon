import os
import sys
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

BACKEND_ROOT = os.path.dirname(os.path.dirname(__file__))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from main import app


class ClearPathAPIContractTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_profile_accepts_and_returns_camel_case(self):
        profile = {
            "id": "commuter-test",
            "name": "Test Rider",
            "persona": "custom",
            "homeAddress": "Punggol",
            "homeCoords": {"lat": 1.4, "lng": 103.9},
            "officeAddress": "one-north",
            "officeCoords": {"lat": 1.3, "lng": 103.78},
            "scheduledDepartureTime": "08:30",
            "flexibleWindowMinutes": 30,
            "notificationLeadTimeMinutes": 45,
            "bringBicycle": True,
            "prioritizeShelter": True,
            "prioritizeLowCrowd": True,
            "motorcycleMode": False,
            "minimizeClutchFatigue": True,
        }
        with patch("main.db.save_commuter_profile", return_value=True):
            response = self.client.post("/api/profile", json=profile)

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["status"], "success")
        self.assertEqual(body["profile"]["scheduledDepartureTime"], "08:30")
        self.assertNotIn("scheduled_departure_time", body["profile"])

    def test_proactive_check_returns_server_routes_and_camel_case(self):
        alerts = {
            "Status": 2,
            "AffectedSegments": [
                {
                    "Line": "PTL",
                    "Stations": "PE1,PE2,PE3",
                    "FreeMRTShuttle": "Free shuttle",
                }
            ],
            "Message": [{"Content": "Test disruption"}],
        }
        weather = {
            "is_raining": False,
            "severity": "None",
            "rainfall_mm": 0,
            "advisory": "Dry",
        }
        crowd = {"PE7": "m", "NE17": "m", "CC23": "m"}

        with (
            patch("main.db.get_commuter_profile") as get_profile,
            patch(
                "services.proactive_engine.lta_service.get_train_service_alerts",
                new=AsyncMock(return_value=alerts),
            ),
            patch(
                "services.proactive_engine.lta_service.get_station_crowd_forecast",
                new=AsyncMock(return_value=crowd),
            ),
            patch(
                "services.proactive_engine.weather_service.check_punggol_cycling_rain",
                new=AsyncMock(return_value=weather),
            ),
            patch(
                "services.routing_service.onemap_service.get_route",
                new=AsyncMock(return_value={"status": "fallback"}),
            ),
        ):
            from models.schemas import CommuterProfile

            get_profile.return_value = CommuterProfile(id="commuter-test")
            response = self.client.post(
                "/api/proactive-check?commuter_id=commuter-test&replay_disruption=true"
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["activeAlerts"])
        self.assertEqual(body["payload"]["suggestedRouteId"], "route-mitigated-disruption")
        self.assertEqual(body["routes"][0]["id"], "route-mitigated-disruption")
        self.assertIn("totalDurationMinutes", body["routes"][0])
        self.assertNotIn("total_duration_minutes", body["routes"][0])

    def test_cors_allows_local_frontend_but_not_unknown_origin(self):
        allowed = self.client.options(
            "/api/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        self.assertEqual(allowed.headers.get("access-control-allow-origin"), "http://localhost:3000")

        unknown = self.client.options(
            "/api/health",
            headers={
                "Origin": "https://untrusted.example",
                "Access-Control-Request-Method": "GET",
            },
        )
        self.assertIsNone(unknown.headers.get("access-control-allow-origin"))

    def test_rain_crowd_and_motorcycle_scenarios_return_matching_routes(self):
        from models.schemas import CommuterProfile

        normal_alerts = {"Status": 1, "AffectedSegments": [], "Message": []}
        cases = [
            (
                "rain",
                CommuterProfile(id="rain-test"),
                {"is_raining": True, "severity": "Heavy Rain", "advisory": "Heavy rain"},
                {"PE7": "m", "NE17": "m"},
                "route-rain-sheltered",
            ),
            (
                "crowd",
                CommuterProfile(id="crowd-test"),
                {"is_raining": False, "severity": "None", "advisory": "Dry"},
                {"PE7": "h", "NE17": "h"},
                "route-proactive-offpeak",
            ),
            (
                "motorcycle",
                CommuterProfile(id="moto-test", motorcycle_mode=True),
                {"is_raining": False, "severity": "None", "advisory": "Dry"},
                {"PE7": "m", "NE17": "m"},
                "moto-route-smooth",
            ),
        ]

        for name, profile, weather, crowd, expected_route in cases:
            with self.subTest(name=name):
                with (
                    patch("main.db.get_commuter_profile", return_value=profile),
                    patch(
                        "services.proactive_engine.lta_service.get_train_service_alerts",
                        new=AsyncMock(return_value=normal_alerts),
                    ),
                    patch(
                        "services.proactive_engine.lta_service.get_station_crowd_forecast",
                        new=AsyncMock(return_value=crowd),
                    ),
                    patch(
                        "services.proactive_engine.weather_service.check_punggol_cycling_rain",
                        new=AsyncMock(return_value=weather),
                    ),
                    patch(
                        "services.routing_service.onemap_service.get_route",
                        new=AsyncMock(return_value={"status": "test"}),
                    ),
                ):
                    response = self.client.post(
                        f"/api/proactive-check?commuter_id={profile.id}"
                    )

                self.assertEqual(response.status_code, 200)
                body = response.json()
                self.assertEqual(body["payload"]["suggestedRouteId"], expected_route)
                self.assertTrue(any(route["id"] == expected_route for route in body["routes"]))

    def test_routes_endpoint_uses_request_parameters(self):
        one_map_route = {
            "status": 0,
            "route_summary": {"total_time": 600, "total_distance": 2500},
            "route_geometry": "",
            "route_instructions": [
                ["Straight", "Cycleway", 2500, "1.31,103.80", 600, "2.5km", "", "", "cycling", "Follow Cycleway"]
            ],
        }
        request = {
            "origin": {"lat": 1.31, "lng": 103.80},
            "destination": {"lat": 1.34, "lng": 103.86},
            "originAddress": "Test Origin",
            "destinationAddress": "Test Destination",
            "departureTime": "09:15",
            "travelMode": "cycle",
            "numItineraries": 1,
            "prioritizeShelter": False,
        }

        with (
            patch(
                "main.lta_service.get_station_crowd_forecast",
                new=AsyncMock(return_value={}),
            ),
            patch(
                "services.routing_service.onemap_service.get_route",
                new=AsyncMock(return_value=one_map_route),
            ) as get_route,
        ):
            response = self.client.post("/api/routes", json=request)

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["provider"], "onemap")
        self.assertEqual(body["routes"][0]["departureTime"], "09:15")
        self.assertEqual(body["routes"][0]["totalDurationMinutes"], 10)
        self.assertEqual(body["routes"][0]["totalDistanceKm"], 2.5)
        self.assertIn("Test Origin → Test Destination", body["routes"][0]["subtitle"])
        self.assertEqual(body["routes"][0]["steps"][0]["mode"], "cycle")
        called = get_route.await_args
        self.assertEqual(called.args[:5], (1.31, 103.8, 1.34, 103.86, "cycle"))
        self.assertEqual(called.kwargs["departure_time"], "09:15")

    def test_routes_endpoint_rejects_coordinates_outside_singapore(self):
        response = self.client.post(
            "/api/routes",
            json={
                "origin": {"lat": 40.7, "lng": -74.0},
                "destination": {"lat": 1.34, "lng": 103.86},
                "departureTime": "09:15",
                "travelMode": "transit",
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_routes_endpoint_normalizes_onemap_transit_legs(self):
        one_map_route = {
            "plan": {
                "itineraries": [
                    {
                        "duration": 1800,
                        "legs": [
                            {
                                "mode": "WALK",
                                "duration": 300,
                                "distance": 350,
                                "from": {"name": "Start", "lat": 1.31, "lon": 103.80},
                                "to": {"name": "Station A", "lat": 1.312, "lon": 103.803},
                                "legGeometry": {"points": ""},
                            },
                            {
                                "mode": "BUS",
                                "duration": 1500,
                                "distance": 7200,
                                "route": "196",
                                "from": {"name": "Station A", "lat": 1.312, "lon": 103.803},
                                "to": {"name": "Finish", "lat": 1.34, "lon": 103.86},
                                "legGeometry": {"points": ""},
                            },
                        ],
                    }
                ]
            }
        }
        request = {
            "origin": {"lat": 1.31, "lng": 103.80},
            "destination": {"lat": 1.34, "lng": 103.86},
            "originAddress": "Start",
            "destinationAddress": "Finish",
            "departureTime": "09:15",
            "travelMode": "transit",
        }

        with (
            patch(
                "main.lta_service.get_station_crowd_forecast",
                new=AsyncMock(return_value={"CC23": "m"}),
            ),
            patch(
                "services.routing_service.onemap_service.get_route",
                new=AsyncMock(return_value=one_map_route),
            ),
        ):
            response = self.client.post("/api/routes", json=request)

        self.assertEqual(response.status_code, 200)
        route = response.json()["routes"][0]
        self.assertEqual(route["modeSummary"], ["walk", "bus"])
        self.assertEqual(route["totalDurationMinutes"], 30)
        self.assertEqual(route["steps"][1]["busServiceNo"], "196")
        self.assertEqual(route["steps"][1]["coordinates"][-1], [1.34, 103.86])

    def test_proactive_check_uses_profile_request_body_immediately(self):
        profile = {
            "id": "dynamic-test",
            "name": "Dynamic Rider",
            "persona": "custom",
            "homeAddress": "Custom Start",
            "homeCoords": {"lat": 1.32, "lng": 103.81},
            "officeAddress": "Custom Finish",
            "officeCoords": {"lat": 1.36, "lng": 103.88},
            "scheduledDepartureTime": "10:05",
            "preferredTravelMode": "cycle",
        }
        normal_alerts = {"Status": 1, "AffectedSegments": [], "Message": []}
        dry_weather = {"is_raining": False, "severity": "None", "advisory": "Dry"}

        with (
            patch("main.db.get_commuter_profile") as get_profile,
            patch(
                "services.proactive_engine.lta_service.get_train_service_alerts",
                new=AsyncMock(return_value=normal_alerts),
            ),
            patch(
                "services.proactive_engine.lta_service.get_station_crowd_forecast",
                new=AsyncMock(return_value={}),
            ),
            patch(
                "services.proactive_engine.weather_service.check_punggol_cycling_rain",
                new=AsyncMock(return_value=dry_weather),
            ),
            patch(
                "services.routing_service.onemap_service.get_route",
                new=AsyncMock(return_value={"status": "fallback"}),
            ),
        ):
            response = self.client.post(
                "/api/proactive-check?commuter_id=dynamic-test", json=profile
            )

        self.assertEqual(response.status_code, 200)
        get_profile.assert_not_called()
        body = response.json()
        self.assertEqual(body["profile"]["scheduledDepartureTime"], "10:05")
        self.assertIn("Custom Start", body["routes"][0]["subtitle"])
        self.assertEqual(body["routes"][0]["modeSummary"], ["cycle"])
        self.assertEqual(body["routes"][0]["steps"][0]["coordinates"][0], [1.32, 103.81])


if __name__ == "__main__":
    unittest.main()
