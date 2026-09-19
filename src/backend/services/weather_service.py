"""
Weather Service (Python/FastAPI)
Integrates data.gov.sg real-time 2-hour nowcast and rainfall API
"""

import httpx
from datetime import datetime, timezone
from typing import Dict, Any, List

class WeatherService:
    NOWCAST_URL = "https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast"
    RAINFALL_URL = "https://api-open.data.gov.sg/v2/real-time/api/rainfall"

    async def get_nowcast(self) -> List[Dict[str, str]]:
        async with httpx.AsyncClient() as client:
            try:
                res = await client.get(self.NOWCAST_URL, timeout=5.0)
                if res.status_code == 200:
                    items = res.json().get("data", {}).get("items", [])
                    if items:
                        return items[0].get("forecasts", [])
            except Exception:
                pass
        return []

    async def get_rainfall(self) -> List[Dict[str, Any]]:
        async with httpx.AsyncClient() as client:
            try:
                res = await client.get(self.RAINFALL_URL, timeout=5.0)
                if res.status_code == 200:
                    items = res.json().get("data", {}).get("items", [])
                    if items:
                        return items[0].get("readings", [])
            except Exception:
                pass
        return []

    async def check_punggol_cycling_rain(self, simulated_rain: bool = False) -> Dict[str, Any]:
        if simulated_rain:
            return {
                "is_raining": True,
                "severity": "Heavy Rain",
                "rainfall_mm": 18.4,
                "advisory": "[SIMULATION] Heavy-rain test value of 18.4 mm/h near the configured origin.",
                "_evidence": self._evidence("simulation", "Judge-controlled heavy-rain fixture; not a data.gov.sg observation."),
            }

        nowcasts = await self.get_nowcast()
        p_forecast = next((f.get("forecast") for f in nowcasts if "punggol" in f.get("area", "").lower()), None)

        if not p_forecast:
            return {
                "is_raining": False,
                "severity": "Unavailable",
                "rainfall_mm": None,
                "advisory": "Weather unavailable; no dry-condition claim is made.",
                "_evidence": self._evidence("reference", "Live data.gov.sg two-hour forecast was unavailable."),
            }

        is_rain = "rain" in p_forecast.lower() or "shower" in p_forecast.lower()
        return {
            "is_raining": is_rain,
            "severity": "Moderate Rain" if is_rain else "None",
            "rainfall_mm": None,
            "advisory": f"data.gov.sg two-hour forecast for Punggol: {p_forecast}.",
            "_evidence": self._evidence("live_api", "Live area forecast; no rainfall intensity is inferred."),
        }

    @staticmethod
    def _evidence(kind: str, detail: str) -> Dict[str, str]:
        return {
            "source": "data.gov.sg two-hour forecast",
            "type": kind,
            "detail": detail,
            "observedAt": datetime.now(timezone.utc).isoformat(),
            "sourceUrl": "https://data.gov.sg/collections/1459/view",
        }

weather_service = WeatherService()
