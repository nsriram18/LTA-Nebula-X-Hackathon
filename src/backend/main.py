"""
ClearPath FastAPI Backend Application
Handles external API orchestration (LTA DataMall & data.gov.sg), OneMap routing,
Firestore persistence and an OIDC-protected endpoint for scheduled proactive checks.
"""

import os
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from dotenv import find_dotenv, load_dotenv
from google.auth.transport import requests as google_auth_requests
from google.oauth2 import id_token

# Load the nearest ignored .env file for local development. Cloud Run injects
# environment variables directly, so this is a no-op in production.
load_dotenv(find_dotenv(usecwd=True))

from models.schemas import (
    CommuterProfile,
    OfflineCacheSaveResponse,
    ProactiveEvaluationResponse,
    ProfileSaveResponse,
    OfflineRouteCache,
    RoutePlanResponse,
    RouteRequest,
    DeleteDataResponse,
    ScheduledCheckResponse,
)
from database.firestore_client import db
from services.lta_service import lta_service
from services.weather_service import weather_service
from services.proactive_engine import proactive_engine
from services.routing_service import routing_service

app = FastAPI(
    title="ClearPath Proactive Commuter Companion API",
    description="Backend API for Problem Statement 2 (PS2) - Smart Commuter Companion",
    version="1.0.0",
)

project_id = os.getenv("GCP_PROJECT_ID", "")
configured_frontend = os.getenv("APP_URL", "").rstrip("/")
allowed_origins = {
    "http://localhost:3000",
    "http://127.0.0.1:3000",
}
if configured_frontend:
    allowed_origins.add(configured_frontend)
if project_id:
    allowed_origins.update(
        {
            f"https://{project_id}.web.app",
            f"https://{project_id}.firebaseapp.com",
        }
    )

# The browser uses bearer-free public API requests, so credentialed CORS is
# intentionally disabled and only known frontend origins are accepted.
app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(allowed_origins),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "ClearPath FastAPI Backend",
        "firestore_connected": db.client is not None,
    }

@app.get("/api/profile", response_model=CommuterProfile, response_model_by_alias=True)
async def get_profile(commuter_id: str = "commuter-arjun-01"):
    return db.get_commuter_profile(commuter_id)

@app.post("/api/profile", response_model=ProfileSaveResponse, response_model_by_alias=True)
async def save_profile(profile: CommuterProfile):
    success = db.save_commuter_profile(profile)
    return ProfileSaveResponse(status="success" if success else "error", profile=profile)

@app.get("/api/alerts")
async def get_train_alerts(replay: bool = False):
    return await lta_service.get_train_service_alerts(replay_mode=replay)

@app.get("/api/crowd")
async def get_crowd_forecast(line: str = "NEL", time_slot: str = "08:30"):
    return await lta_service.get_station_crowd_forecast(line, time_slot)

@app.get("/api/bus-arrivals")
async def get_bus_arrivals(bus_stop_code: str = "65199"):
    return await lta_service.get_bus_arrivals(bus_stop_code)

@app.get("/api/weather/nowcast")
async def get_weather_nowcast():
    return await weather_service.get_nowcast()

@app.get("/api/weather/rainfall")
async def get_rainfall():
    return await weather_service.get_rainfall()

@app.get("/api/speed-bands")
async def get_traffic_speed_bands():
    return await lta_service.get_traffic_speed_bands()


@app.get("/api/planned-events")
async def get_planned_events(origin_address: str = "", destination_address: str = ""):
    return await lta_service.get_planned_events(origin_address, destination_address)


@app.post(
    "/api/routes",
    response_model=RoutePlanResponse,
    response_model_by_alias=True,
)
async def calculate_routes(request: RouteRequest):
    """Calculate routes from explicit origin, destination, time, and preferences."""
    crowd = await lta_service.get_station_crowd_forecast(
        "NEL", request.departure_time
    )
    routes, provider = await routing_service.plan_route(request, crowd)
    return RoutePlanResponse(routes=routes, provider=provider)

@app.post(
    "/api/proactive-check",
    response_model=ProactiveEvaluationResponse,
    response_model_by_alias=True,
)
async def run_proactive_check(
    profile: CommuterProfile | None = None,
    replay_disruption: bool = Query(False),
    simulated_rain: bool = Query(False),
    simulated_crowd: bool = Query(False),
    commuter_id: str = "commuter-arjun-01",
):
    active_profile = profile or db.get_commuter_profile(commuter_id)
    return await proactive_engine.evaluate_commute(
        active_profile,
        replay_disruption=replay_disruption,
        simulated_rain=simulated_rain,
        simulated_crowd=simulated_crowd,
    )

@app.post(
    "/api/offline-cache",
    response_model=OfflineCacheSaveResponse,
    response_model_by_alias=True,
)
async def cache_offline_route(cache: OfflineRouteCache, commuter_id: str = "commuter-arjun-01"):
    success = db.cache_offline_route(commuter_id, cache)
    return OfflineCacheSaveResponse(
        status="cached" if success else "error",
        cached_at=cache.cached_at,
    )

@app.get(
    "/api/offline-cache",
    response_model=OfflineRouteCache | None,
    response_model_by_alias=True,
)
async def get_offline_cache(commuter_id: str = "commuter-arjun-01"):
    cached = db.get_cached_offline_route(commuter_id)
    return OfflineRouteCache(**cached) if cached else None


@app.get("/api/notifications/latest")
async def get_latest_notification(commuter_id: str = "commuter-arjun-01"):
    stored = db.get_notification(commuter_id)
    return {"notification": stored.get("notification") if stored else None}


@app.post(
    "/api/scheduled-check",
    response_model=ScheduledCheckResponse,
    response_model_by_alias=True,
)
async def scheduled_check(
    commuter_id: str = "commuter-arjun-01",
    authorization: str = Header(default=""),
):
    expected_audience = os.getenv("APP_URL", "").rstrip("/")
    expected_service_account = os.getenv("SCHEDULER_SERVICE_ACCOUNT", "")
    if not authorization.startswith("Bearer ") or not expected_audience or not expected_service_account:
        raise HTTPException(status_code=401, detail="Missing scheduler identity")
    try:
        claims = id_token.verify_oauth2_token(
            authorization.removeprefix("Bearer "),
            google_auth_requests.Request(),
            audience=expected_audience,
        )
    except ValueError as error:
        raise HTTPException(status_code=401, detail="Invalid scheduler identity") from error
    if claims.get("email") != expected_service_account:
        raise HTTPException(status_code=403, detail="Unexpected scheduler identity")

    profile = db.get_commuter_profile(commuter_id)
    now = datetime.now(ZoneInfo("Asia/Singapore"))
    hour, minute = (int(value) for value in profile.scheduled_departure_time.split(":"))
    departure = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    minutes_until = round((departure - now).total_seconds() / 60)
    if minutes_until < 0:
        minutes_until += 24 * 60
    if abs(minutes_until - profile.notification_lead_time_minutes) > 2:
        return ScheduledCheckResponse(
            status="outside_window",
            commuter_id=commuter_id,
            evaluated_at=now.isoformat(),
            minutes_until_departure=minutes_until,
        )

    result = await proactive_engine.evaluate_commute(profile)
    if result.payload:
        db.save_notification(
            commuter_id,
            {
                "storedAt": now.isoformat(),
                "expiresAt": departure.isoformat(),
                "notification": result.payload.model_dump(by_alias=True),
            },
        )
    return ScheduledCheckResponse(
        status="evaluated",
        commuter_id=commuter_id,
        evaluated_at=now.isoformat(),
        minutes_until_departure=minutes_until,
        notification=result.payload,
    )


@app.delete(
    "/api/data",
    response_model=DeleteDataResponse,
    response_model_by_alias=True,
)
async def delete_commuter_data(commuter_id: str = "commuter-arjun-01"):
    db.delete_commuter_data(commuter_id)
    return DeleteDataResponse(status="deleted", commuter_id=commuter_id)


STATIC_DIR = (Path(__file__).resolve().parent / "static").resolve()


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_frontend(full_path: str):
    """Serve compiled React assets and fall back to index.html for SPA routes."""
    if full_path == "api" or full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")

    requested = (STATIC_DIR / full_path).resolve()
    try:
        requested.relative_to(STATIC_DIR)
    except ValueError as error:
        raise HTTPException(status_code=404, detail="File not found") from error

    if requested.is_file():
        cache_control = (
            "no-cache"
            if requested.name in {"index.html", "sw.js"}
            else "public, max-age=31536000, immutable"
        )
        return FileResponse(requested, headers={"Cache-Control": cache_control})

    index_file = STATIC_DIR / "index.html"
    if index_file.is_file():
        return FileResponse(index_file, headers={"Cache-Control": "no-cache"})

    raise HTTPException(status_code=404, detail="Frontend build is not available")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
