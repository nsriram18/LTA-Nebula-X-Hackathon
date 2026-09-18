"""
Weather Service (Python/FastAPI)
Integrates data.gov.sg real-time 2-hour nowcast and rainfall API
"""

import httpx
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
        return [{"area": "Punggol", "forecast": "Partly Cloudy"}]

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
        return [{"stationId": "S107", "value": 0.0}]

    async def check_punggol_cycling_rain(self, simulated_rain: bool = False) -> Dict[str, Any]:
        if simulated_rain:
            return {
                "is_raining": True,
                "severity": "Heavy Rain",
                "rainfall_mm": 18.4,
                "advisory": "Torrential rain cell (18.4 mm/h) over Punggol Park Connector. Reroute to CoveredLinkWay or shift departure +20 min.",
            }

        nowcasts = await self.get_nowcast()
        p_forecast = next((f.get("forecast") for f in nowcasts if "punggol" in f.get("area", "").lower()), "Fair")

        is_rain = "rain" in p_forecast.lower() or "shower" in p_forecast.lower()
        return {
            "is_raining": is_rain,
            "severity": "Moderate Rain" if is_rain else "None",
            "rainfall_mm": 5.0 if is_rain else 0.0,
            "advisory": "Wet conditions on cycling link" if is_rain else "Dry and clear along cycling link",
        }

weather_service = WeatherService()
