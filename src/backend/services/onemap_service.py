"""
OneMap Routing API Service (Python/FastAPI)
Provides multi-modal pathfinding covering walk, cycle, and transit options
"""

import logging
import os
from datetime import date, datetime
from typing import Any, Dict, Optional
from zoneinfo import ZoneInfo

import httpx

logger = logging.getLogger(__name__)

class OneMapService:
    BASE_URL = "https://www.onemap.gov.sg/api/public"
    AUTH_URL = "https://www.onemap.gov.sg/api/auth/post/getToken"

    def __init__(self):
        self.api_token = os.getenv("ONEMAP_API_TOKEN", "")
        self.email = os.getenv("ONEMAP_EMAIL", "")
        self.password = os.getenv("ONEMAP_PASSWORD", "")

    async def _refresh_token(self, client: httpx.AsyncClient) -> str:
        if not self.email or not self.password:
            return ""
        try:
            response = await client.post(
                self.AUTH_URL,
                json={"email": self.email, "password": self.password},
                timeout=8.0,
            )
            payload = response.json()
            token = payload.get("access_token") if response.status_code == 200 else None
            if isinstance(token, str) and token:
                self.api_token = token
                return token
            logger.warning("OneMap token refresh failed with status %s", response.status_code)
        except (httpx.HTTPError, ValueError) as error:
            logger.warning("OneMap token refresh unavailable: %s", error)
        return ""

    async def get_route(
        self,
        start_lat: float,
        start_lng: float,
        end_lat: float,
        end_lng: float,
        route_type: str = "pt",
        departure_time: str = "08:30",
        departure_date: Optional[date] = None,
        mode: str = "transit",
        max_walk_distance: int = 1000,
        num_itineraries: int = 2,
    ) -> Dict[str, Any]:
        params = {
            "start": f"{start_lat},{start_lng}",
            "end": f"{end_lat},{end_lng}",
            "routeType": route_type,
        }

        if route_type == "pt":
            travel_date = departure_date or datetime.now(ZoneInfo("Asia/Singapore")).date()
            params.update(
                {
                    "date": travel_date.strftime("%m-%d-%Y"),
                    "time": f"{departure_time}:00",
                    "mode": mode.upper(),
                    "maxWalkDistance": str(max_walk_distance),
                    "numItineraries": str(num_itineraries),
                }
            )

        async with httpx.AsyncClient() as client:
            try:
                token = self.api_token or await self._refresh_token(client)
                if not token:
                    return {
                        "status": "fallback",
                        "status_message": "OneMap credentials are not configured",
                    }

                async def send(active_token: str) -> tuple[httpx.Response, Dict[str, Any]]:
                    response = await client.get(
                        f"{self.BASE_URL}/routingsvc/route",
                        headers={"Authorization": active_token},
                        params=params,
                        timeout=8.0,
                    )
                    return response, response.json()

                res, payload = await send(token)
                auth_error = str(payload.get("error", "")).lower()
                if res.status_code == 401 or any(
                    marker in auth_error for marker in ("token expired", "invalid authentication", "token missing")
                ):
                    refreshed = await self._refresh_token(client)
                    if refreshed:
                        res, payload = await send(refreshed)

                if res.status_code == 200:
                    if payload.get("error"):
                        return {
                            "status": "fallback",
                            "upstream_status": res.status_code,
                            "status_message": payload["error"],
                        }
                    return payload
                logger.warning(
                    "OneMap route request failed with status %s: %s",
                    res.status_code,
                    payload.get("error") or payload.get("status_message"),
                )
                return {
                    "status": "fallback",
                    "upstream_status": res.status_code,
                    "status_message": payload.get("error")
                    or payload.get("status_message")
                    or "OneMap route request failed",
                }
            except (httpx.HTTPError, ValueError) as error:
                logger.warning("OneMap route request unavailable: %s", error)

        return {"status": "fallback", "status_message": "OneMap is unavailable"}

onemap_service = OneMapService()
