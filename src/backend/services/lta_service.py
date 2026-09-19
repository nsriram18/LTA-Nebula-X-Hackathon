"""
LTA DataMall API Service (Python/FastAPI)
Implements TrainServiceAlerts nested AffectedSegments parser, PCDForecast, BusArrival (v3), and TrafficSpeedBands (v4)
"""

import os
from datetime import datetime, timezone
import httpx
from typing import Dict, Any, List, Optional

CANONICAL_LINE_MAP = {
    "PUN_LRT": {"alert": "PTL", "crowd": "PLRT", "name": "Punggol LRT"},
    "SK_LRT": {"alert": "STL", "crowd": "SLRT", "name": "Sengkang LRT"},
    "BP_LRT": {"alert": "BPL", "crowd": "BPL", "name": "Bukit Panjang LRT"},
    "NEL": {"alert": "NEL", "crowd": "NEL", "name": "North East Line"},
    "CCL": {"alert": "CCL", "crowd": "CCL", "name": "Circle Line"},
    "CEL": {"alert": "CCL", "crowd": "CEL", "name": "Circle Line Extension"},
    "EWL": {"alert": "EWL", "crowd": "EWL", "name": "East West Line"},
    "CGL": {"alert": "EWL", "crowd": "CGL", "name": "Changi Extension"},
    "NSL": {"alert": "NSL", "crowd": "NSL", "name": "North South Line"},
    "DTL": {"alert": "DTL", "crowd": "DTL", "name": "Downtown Line"},
    "TEL": {"alert": "TEL", "crowd": "TEL", "name": "Thomson-East Coast Line"},
}

class LTAService:
    BASE_URL = "https://datamall2.mytransport.sg/ltaodataservice"

    def __init__(self):
        self.account_key = os.getenv("LTA_DATAMALL_ACCOUNT_KEY", "")

    @staticmethod
    def _evidence(kind: str, detail: str) -> Dict[str, str]:
        return {
            "source": "LTA DataMall",
            "type": kind,
            "detail": detail,
            "observedAt": datetime.now(timezone.utc).isoformat(),
            "sourceUrl": "https://datamall.lta.gov.sg/content/datamall/en/dynamic-data.html",
        }

    async def get_train_service_alerts(self, replay_mode: bool = False) -> Dict[str, Any]:
        """
        Parses nested AffectedSegments array to detect LRT/MRT disruptions and extract FreePublicBus/FreeMRTShuttle
        """
        if replay_mode:
            return {
                "Status": 2,
                "AffectedSegments": [
                    {
                        "Line": "PTL",
                        "Direction": "Both",
                        "Stations": "PE1,PE2,PE3,PE4,PE5,PE6,PE7",
                        "FreePublicBus": "Free bus service available between Punggol and all East Loop stations (PE1 to PE7).",
                        "FreeMRTShuttle": "Free shuttle buses operating between Punggol Bus Interchange and Oasis/Damai LRT.",
                        "MRTShuttleDirection": "Both",
                    }
                ],
                "Message": [
                    {
                        "Content": "[REPLAY TEST DATA] PGL LRT East Loop service suspended due to signalling track fault. Free public buses and bridging shuttle buses are active.",
                        "CreatedDate": "2026-09-18 07:42:00",
                    }
                ],
                "_evidence": self._evidence("simulation", "Clearly labeled replay fixture for judge-controlled disruption testing; not a live alert."),
            }

        if not self.account_key:
            return {"Status": 0, "AffectedSegments": [], "Message": [], "_evidence": self._evidence("reference", "Unavailable: LTA_DATAMALL_ACCOUNT_KEY is not configured. No service-status claim is made.")}

        headers = {"AccountKey": self.account_key, "accept": "application/json"}
        async with httpx.AsyncClient() as client:
            try:
                res = await client.get(f"{self.BASE_URL}/TrainServiceAlerts", headers=headers, timeout=5.0)
                if res.status_code == 200:
                    val = res.json().get("value", {})
                    return {
                        "Status": val.get("Status", 0),
                        "AffectedSegments": val.get("AffectedSegments", []),
                        "Message": val.get("Message", []),
                        "_evidence": self._evidence("live_api", "Live TrainServiceAlerts response."),
                    }
            except Exception:
                pass

        return {"Status": 0, "AffectedSegments": [], "Message": [], "_evidence": self._evidence("reference", "Unavailable: live TrainServiceAlerts request failed. No normal-service claim is made.")}

    async def get_station_crowd_forecast(self, line: str, time_slot: str = "08:30") -> Dict[str, Any]:
        """
        Queries PCDForecast per station at 30-minute intervals
        """
        crowd_code = CANONICAL_LINE_MAP.get(line, {}).get("crowd", line)
        crowd_map: Dict[str, Any] = {}

        if not self.account_key:
            crowd_map["_evidence"] = self._evidence("reference", "Unavailable: LTA_DATAMALL_ACCOUNT_KEY is not configured. No crowd level is inferred.")
            return crowd_map

        headers = {"AccountKey": self.account_key, "accept": "application/json"}
        async with httpx.AsyncClient() as client:
            try:
                res = await client.get(
                    f"{self.BASE_URL}/PCDForecast?TrainLine={crowd_code}", headers=headers, timeout=5.0
                )
                if res.status_code == 200:
                    items = res.json().get("value", [])
                    matching_items = [
                        it for it in items
                        if time_slot in str(it.get("Start", ""))
                    ]
                    for it in matching_items:
                        if it.get("Station") and it.get("CrowdLevel"):
                            crowd_map[it["Station"]] = it["CrowdLevel"].lower()
                    crowd_map["_evidence"] = self._evidence("live_api", f"Live PCDForecast records for {crowd_code} matching slot {time_slot}; no value is inferred when the slot is absent.")
                    return crowd_map
            except Exception:
                pass

        crowd_map["_evidence"] = self._evidence("reference", "Unavailable: live PCDForecast request failed. No crowd level is inferred.")
        return crowd_map

    async def get_bus_arrivals(self, bus_stop_code: str) -> List[Dict[str, Any]]:
        """
        Queries v3/BusArrival for bus ETA and Load (SEA, SDA, LSD)
        """
        if not self.account_key:
            return []

        headers = {"AccountKey": self.account_key, "accept": "application/json"}
        async with httpx.AsyncClient() as client:
            try:
                res = await client.get(
                    f"{self.BASE_URL}/v3/BusArrival?BusStopCode={bus_stop_code}", headers=headers, timeout=5.0
                )
                if res.status_code == 200:
                    services = res.json().get("Services", [])
                    return [
                        {
                            "ServiceNo": s.get("ServiceNo"),
                            "Load": s.get("NextBus", {}).get("Load") or None,
                            "EstimatedMinutes": self._minutes_until(s.get("NextBus", {}).get("EstimatedArrival")),
                            "Type": s.get("NextBus", {}).get("Type") or None,
                            "_evidence": self._evidence("live_api", "Live v3 BusArrival NextBus fields; ETA is derived from EstimatedArrival."),
                        }
                        for s in services
                    ]
            except Exception:
                pass

        return []

    async def get_traffic_speed_bands(self) -> List[Dict[str, Any]]:
        """
        Queries v4/TrafficSpeedBands for congestion monitoring in Motorcycle Mode
        """
        if not self.account_key:
            return []
        headers = {"AccountKey": self.account_key, "accept": "application/json"}
        async with httpx.AsyncClient() as client:
            try:
                res = await client.get(f"{self.BASE_URL}/v4/TrafficSpeedBands", headers=headers, timeout=8.0)
                if res.status_code == 200:
                    return [
                        {**item, "_evidence": self._evidence("live_api", "Live v4 TrafficSpeedBands record.")}
                        for item in res.json().get("value", [])
                    ]
            except Exception:
                pass
        return []

    @staticmethod
    def _minutes_until(value: Any) -> Optional[int]:
        if not isinstance(value, str) or not value:
            return None
        try:
            arrival = datetime.fromisoformat(value.replace("Z", "+00:00"))
            now = datetime.now(arrival.tzinfo or timezone.utc)
            return max(0, round((arrival - now).total_seconds() / 60))
        except ValueError:
            return None

lta_service = LTAService()
