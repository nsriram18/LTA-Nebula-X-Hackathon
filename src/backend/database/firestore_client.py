"""
Google Cloud Firestore Database Operations
Using google-cloud-firestore Python SDK
"""

import os
import logging
from typing import Optional, Dict, Any
from google.cloud import firestore
from models.schemas import CommuterProfile, OfflineRouteCache

logger = logging.getLogger("clearpath.firestore")

class FirestoreDB:
    def __init__(self):
        self.client: Optional[firestore.Client] = None
        self._in_memory_fallback: Dict[str, Dict[str, Any]] = {
            "commuters": {},
            "offline_caches": {},
            "notifications": {},
        }
        self.init_client()

    def init_client(self):
        project_id = os.getenv("GCP_PROJECT_ID")
        database_id = os.getenv("FIRESTORE_DATABASE_ID", "(default)")

        try:
            # Uses ambient Application Default Credentials. In Cloud Run these
            # come from the service's attached runtime service account.
            if project_id:
                self.client = firestore.Client(project=project_id, database=database_id)
                logger.info(f"Connected to Google Cloud Firestore [Project: {project_id}]")
            else:
                self.client = firestore.Client(database=database_id)
                logger.info("Connected to default GCP Firestore instance")
        except Exception as e:
            logger.warning(
                f"GCP Firestore credentials not detected. Falling back to high-performance in-memory cache: {e}"
            )
            self.client = None

    def save_commuter_profile(self, profile: CommuterProfile) -> bool:
        data = profile.model_dump()
        if self.client:
            try:
                self.client.collection("commuters").document(profile.id).set(data)
                return True
            except Exception as e:
                logger.error(f"Firestore save error: {e}")
        self._in_memory_fallback["commuters"][profile.id] = data
        return True

    def get_commuter_profile(self, commuter_id: str) -> Optional[CommuterProfile]:
        if self.client:
            try:
                doc = self.client.collection("commuters").document(commuter_id).get()
                if doc.exists:
                    return CommuterProfile(**doc.to_dict())
            except Exception as e:
                logger.error(f"Firestore fetch error: {e}")

        cached = self._in_memory_fallback["commuters"].get(commuter_id)
        if cached:
            return CommuterProfile(**cached)
        return CommuterProfile(id=commuter_id)

    def cache_offline_route(self, commuter_id: str, cache: OfflineRouteCache) -> bool:
        data = cache.model_dump()
        if self.client:
            try:
                self.client.collection("offline_caches").document(commuter_id).set(data)
                return True
            except Exception as e:
                logger.error(f"Firestore offline cache error: {e}")
        self._in_memory_fallback["offline_caches"][commuter_id] = data
        return True

    def get_cached_offline_route(self, commuter_id: str) -> Optional[Dict[str, Any]]:
        if self.client:
            try:
                doc = self.client.collection("offline_caches").document(commuter_id).get()
                if doc.exists:
                    return doc.to_dict()
            except Exception as e:
                logger.error(f"Firestore fetch offline route error: {e}")
        return self._in_memory_fallback["offline_caches"].get(commuter_id)

db = FirestoreDB()
