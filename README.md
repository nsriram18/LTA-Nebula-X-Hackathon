# ClearPath — Proactive Commuter Companion

Singapore Problem Statement 2 submission for Arjun, a flexible-start, multi-modal commuter travelling from Punggol to one-north.

- **Live app:** [https://lta-nebula-x-hackathon-314751883323.us-central1.run.app](https://lta-nebula-x-hackathon-314751883323.us-central1.run.app)
- **Pitch video:** Pending final physical-phone recording
- **Architecture and evidence:** [WRITEUP.md](WRITEUP.md)

## What ClearPath does

ClearPath retains Arjun's original OneMap journey and checks train disruption, station crowd forecasts, weather and LTA planned events before departure. It recommends a different journey only after making a separate routing/data request that supports the change. Estimated, simulated, cached and unavailable values are labelled explicitly.

## Prerequisites

| Component | Version |
|---|---|
| Node.js | 18 or newer; 20+ recommended |
| npm | 9 or newer |
| Python | 3.10 or newer |
| Docker | Optional, version 24 or newer |

## Configuration

Copy the environment template. It contains variable names and non-secret configuration only.

```bash
cp .env.example .env
```

| Variable | Purpose | Source |
|---|---|---|
| `LTA_DATAMALL_ACCOUNT_KEY` | LTA live and planned transport feeds | [LTA DataMall API access](https://datamall.lta.gov.sg/content/datamall/en/request-for-api.html) |
| `ONEMAP_EMAIL` | OneMap token refresh | [OneMap API](https://www.onemap.gov.sg/apidocs/) |
| `ONEMAP_PASSWORD` | OneMap token refresh | OneMap account |
| `ONEMAP_API_TOKEN` | OneMap routing bearer token | OneMap account |
| `GCP_PROJECT_ID` | Firestore project | Google Cloud Console |
| `FIRESTORE_DATABASE_ID` | Firestore database; normally `(default)` | Google Cloud Console |
| `APP_URL` | Allowed frontend origin and scheduler OIDC audience | Local or Cloud Run URL |
| `SCHEDULER_SERVICE_ACCOUNT` | Expected OIDC caller for scheduled checks | Runtime service-account email |
| `VITE_API_BASE_URL` | Optional local frontend API override | `http://localhost:8080` for local backend |

Never expose LTA or OneMap secrets with a `VITE_` prefix. Production values are injected from Secret Manager into Cloud Run.

## Fastest evaluation path

This starts the frontend locally and uses the deployed Cloud Run API. Internet access is required.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Fully local frontend and backend

Terminal 1:

```bash
cd src/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```

Terminal 2, from the repository root:

```bash
cp .env.example .env
```

Set `VITE_API_BASE_URL=http://localhost:8080` in the ignored `.env`, then run:

```bash
npm install
npm run dev
```

The API documentation is at `http://localhost:8080/docs`.

Without Google credentials, Firestore uses process-memory storage. Without OneMap or LTA credentials, affected values become unavailable or a route becomes an explicitly labelled estimate; the app does not invent a healthy feed.

## Docker

The root container builds React and serves it from FastAPI, matching Cloud Run.

```bash
docker build -t clearpath .
docker run --env-file .env -p 8080:8080 clearpath
```

Open `http://localhost:8080`.

## Judge journey

1. Open the live app. The welcome flow explains the journey header, route sheet and Demo Lab.
2. Select **Explore sample journey**. The map displays Arjun's parameter-driven OneMap journey.
3. Open **Demo Lab** and select **Train disruption replay**. The replay is labelled `SIMULATION`. If OneMap returns a verified bus-only journey, it appears beside the grey original route. Otherwise the app explicitly says that a rail-free alternative could not be verified.
4. Select **Heavy rain**. ClearPath makes a separate bus request and removes cycling only when the returned journey supports that claim. No shelter percentage is invented.
5. Select **High platform crowd**. The demo makes separate scheduled-time and shifted-time crowd checks and a second OneMap request. The comparison displays both crowd categories.
6. Expand **View journey** to inspect planned LTA events, alternatives, directions, timing uncertainty and **Sources & calculations**.
7. Select **Simulate tunnel**. The saved journey and timestamp are labelled `CACHED`.
8. Open journey settings to change the origin, destination, coordinates, departure time and mode, or use **Delete my ClearPath data**.

## Evidence behavior

| Value | Evidence | Unavailable behavior |
|---|---|---|
| Route geometry/time/distance | OneMap | Labelled Haversine estimate with formula |
| Crowd | LTA `PCDForecast` or simulation | `Unavailable` |
| Train disruption | LTA `TrainServiceAlerts` or replay | No normal-service assertion |
| Planned events | LTA `RoadWorks`, `RoadOpenings`, `PlannedBusRoutes` | Planned-event section omitted |
| Weather | data.gov.sg or simulation | Unknown; no dry-weather assertion |
| Offline journey | Saved snapshot | `CACHED` with saved time |

## Deployment

- Google Cloud project: `qwiklabs-gcp-02-e3a0cea27f91`
- Region: `us-central1`
- Cloud Run service: `lta-nebula-x-hackathon`
- Firestore database: `(default)`
- Scheduler job: `clearpath-proactive-check`
- Health check: [Cloud Run health endpoint](https://lta-nebula-x-hackathon-314751883323.us-central1.run.app/api/health)

`cloudbuild.yaml` builds the combined image, publishes it to Artifact Registry and deploys it with the dedicated runtime service account and Secret Manager values. Cloud Scheduler sends an OIDC-authenticated request every five minutes; the API performs work only at the profile's configured lead time.

## Privacy

ClearPath stores commute addresses/coordinates, preferences, the latest active journey and the latest scheduled notification. It does not collect continuous location history. Firestore records and browser storage remain until the user selects **Delete my ClearPath data**; route and notification snapshots are overwritten as newer ones are saved. Full details are in [WRITEUP.md](WRITEUP.md).

## Validation

```bash
npm run lint
npm run build
npm run check:secrets
cd src/backend
python -m unittest discover -s tests -v
```

Before submission, repeat the judge journey on the physical phone used for the video, including Airplane Mode, portrait orientation, bright-light readability and one-handed controls.
