"""
OneMap Routing API Service (Python/FastAPI)
Provides multi-modal pathfinding covering walk, cycle, and transit options
"""

import os
import httpx
from typing import Dict, Any, List

class OneMapService:
    BASE_URL = "https://www.onemap.gov.sg/api/public"

    def __init__(self):
        self.api_token = os.getenv("ONEMAP_API_TOKEN", "")

    async def get_route(
        self,
        start_lat: float,
        start_lng: float,
        end_lat: float,
        end_lng: float,
        route_type: str = "pt",  # 'pt' (public transport), 'walk', 'cycle'
    ) -> Dict[str, Any]:
        if not self.api_token:
            return {"status": "mock", "route_type": route_type, "duration_minutes": 42}

        headers = {"Authorization": self.api_token}
        params = {
            "start": f"{start_lat},{start_lng}",
            "end": f"{end_lat},{end_lng}",
            "routeType": route_type,
        }

        async with httpx.AsyncClient() as client:
            try:
                res = await client.get(
                    f"{self.BASE_URL}/routingsvc/route",
                    headers=headers,
                    params=params,
                    timeout=8.0,
                )
                if res.status_code == 200:
                    return res.json()
            except Exception:
                pass

        return {"status": "fallback", "duration_minutes": 42}

onemap_service = OneMapService()
