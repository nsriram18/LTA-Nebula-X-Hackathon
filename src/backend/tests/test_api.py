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


if __name__ == "__main__":
    unittest.main()
