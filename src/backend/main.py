"""
ClearPath FastAPI Backend Application
Handles external API orchestration (LTA DataMall & data.gov.sg), OneMap routing,
Firestore database integration, and the 45-minute proactive engine background worker.
"""

import os
from fastapi import FastAPI, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from models.schemas import (
    CommuterProfile,
    ProactiveNotificationPayload,
    OfflineRouteCache,
)
from database.firestore_client import db
from services.lta_service import lta_service
from services.weather_service import weather_service
from services.proactive_engine import proactive_engine

app = FastAPI(
    title="ClearPath Proactive Commuter Companion API",
    description="Backend API for Problem Statement 2 (PS2) - Smart Commuter Companion",
    version="1.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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

@app.get("/api/profile", response_model=CommuterProfile)
async def get_profile(commuter_id: str = "commuter-arjun-01"):
    return db.get_commuter_profile(commuter_id)

@app.post("/api/profile")
async def save_profile(profile: CommuterProfile):
    success = db.save_commuter_profile(profile)
    return {"status": "success" if success else "error", "profile": profile}

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

@app.post("/api/proactive-check")
async def run_proactive_check(
    replay_disruption: bool = Query(False),
    simulated_rain: bool = Query(False),
    commuter_id: str = "commuter-arjun-01",
):
    profile = db.get_commuter_profile(commuter_id)
    notif = await proactive_engine.evaluate_commute(
        profile,
        replay_disruption=replay_disruption,
        simulated_rain=simulated_rain,
    )
    return {"notification": notif, "profile": profile}

@app.post("/api/offline-cache")
async def cache_offline_route(cache: OfflineRouteCache, commuter_id: str = "commuter-arjun-01"):
    db.cache_offline_route(commuter_id, cache)
    return {"status": "cached", "cached_at": cache.cached_at}

@app.get("/api/offline-cache")
async def get_offline_cache(commuter_id: str = "commuter-arjun-01"):
    return db.get_cached_offline_route(commuter_id) or {}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
