# ClearPath — Proactive Commuter Companion
> **Singapore Problem Statement 2 (PS2) Challenge Submission**  
> Tailored specifically for **Arjun** (Multi-modal, flexible-start commuter travelling from Punggol to one-north).

**Live frontend:** [https://lta-nebula-x-hackathon-314751883323.us-central1.run.app](https://lta-nebula-x-hackathon-314751883323.us-central1.run.app)

---

## 1. Quick Overview

ClearPath is a proactive, mobile-first commuter companion application built on OpenStreetMap geospatial data, Singapore LTA DataMall real-time feeds, and data.gov.sg weather analytics.

Unlike reactive transit applications that announce delays while a commuter is already stranded on a crowded platform, ClearPath's **Proactive Engine** runs a background evaluation **45 minutes prior** to the scheduled commute. If rail disruptions, severe station congestion, or localized rain cells along the cycling leg are detected, ClearPath proactively computes and delivers a decisive action: an optimized departure time shift or an alternative multi-modal route utilizing LTA CoveredLinkWays and Free Bridging Transit.

---

## 2. Prerequisites

| Component | Required Runtime / Version | Package Manager |
|---|---|---|
| **Frontend UI / Client** | Node.js `>= 18.0.0` (v20+ recommended) | `npm` `>= 9.0.0` |
| **Backend & Proactive Worker** | Python `>= 3.10.0` (v3.11 recommended) | `pip` |
| **Containerization (Optional)** | Docker `>= 24.0.0` | Docker CLI / Cloud Run |

---

## 3. Configuration (`.env`)

ClearPath requires no hardcoded credentials. An environment template is provided in `.env.example`.

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### Environment Variables Description
| Variable Name | Purpose | Where to Obtain |
|---|---|---|
| `LTA_DATAMALL_ACCOUNT_KEY` | LTA DataMall feeds (`TrainServiceAlerts`, `PCDForecast`, `v3/BusArrival`, `v4/TrafficSpeedBands`) | Free registration at [LTA DataMall](https://datamall.lta.gov.sg) |
| `ONEMAP_EMAIL` & `ONEMAP_PASSWORD` | OneMap routing & reverse geocoding API | Free registration at [OneMap API Docs](https://www.onemap.gov.sg/apidocs/) |
| `ONEMAP_API_TOKEN` | Bearer token for OneMap Routing | Generated from OneMap account |
| `GCP_PROJECT_ID` | Google Cloud project ID for Firestore | GCP Cloud Console |
| `FIRESTORE_DATABASE_ID` | Firestore database ID (defaults to `(default)`) | GCP Firestore |

`LTA_DATAMALL_ACCOUNT_KEY`, `ONEMAP_EMAIL`, `ONEMAP_PASSWORD`, and
`ONEMAP_API_TOKEN` are backend-only secrets. Do not prefix them with `VITE_` or
otherwise include them in the browser build. In Cloud Run, inject them from
Google Secret Manager. Cloud Run authenticates to Firestore using its attached
service account through Application Default Credentials; do not deploy a
service-account JSON key.

> **Data-integrity behavior:**
> If an upstream feed is unavailable, ClearPath reports that metric as unavailable instead of inventing a normal service, crowd, weather, bus-arrival, or traffic reading. If OneMap fails, the replacement is visibly titled **Estimated Fallback Route**, with its formula exposed in the UI. Saved underground journeys are visibly labeled **CACHED**.

---

## 4. Install & Run Commands (Step-by-Step)

### Option A: Running the Complete Full-Stack Web Application (Recommended for Instant Evaluation)

```bash
# 1. Install frontend dependencies
npm install

# 2. Start the dev server (Vite on port 3000)
npm run dev
```

Open your mobile browser or desktop browser at:
👉 **`http://localhost:3000`**

---

### Option B: Running the Python FastAPI Backend Independently

```bash
# 1. Navigate to backend directory
cd src/backend

# 2. Create and activate a Python virtual environment
python3 -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Launch FastAPI server with Uvicorn
uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```

Backend API Swagger Docs will be accessible at:
👉 **`http://localhost:8080/docs`**

---

### Option C: Running with Docker (Cloud Run Container Image)

```bash
# Build Docker image
docker build -t clearpath-backend .

# Run Docker container
docker run -p 8080:8080 -e PORT=8080 clearpath-backend
```

---

## 5. What to Click: Step-by-Step Judge Journey

Follow this journey to test ClearPath end-to-end:

1. **Launch App**: Open `http://localhost:3000`. First-time visitors receive a short product introduction and can either set up a commute or explore the sample journey. Three optional coach marks introduce the journey header, expandable route card, and Demo Lab.
2. **Observe the map-first journey**:
   - The initial profile's scheduled commute is **08:30 AM**; origin, destination, coordinates, time, and mode are editable.
   - The map occupies most of the mobile screen. Tap **View journey** to reveal alternatives and directions, or expand fully for **Sources & calculations**.
   - Tap **Layers** to enable the optional sheltered-walkway, cycling-path, and reference-station overlays.
3. **Simulate Train Disruption Replay**:
   - Open **Demo Lab**, then tap **"Train disruption replay"**.
   - This is visibly labeled **SIMULATION**. It exercises nested `AffectedSegments`, `FreeMRTShuttle`, and `FreePublicBus` handling without claiming a current disruption.
4. **Simulate Torrential Rain on Cycling Leg**:
   - In **Demo Lab**, tap **"Heavy rain"** to activate a clearly labeled **SIMULATION** value of **18.4 mm/h** near the configured origin.
   - No clearance time, shelter percentage, bus load, or road-friction value is asserted without evidence.
5. **Simulate Underground / Loss of Cellular Signal**:
   - In **Demo Lab**, tap **"Simulate tunnel"** (or switch your phone to Airplane Mode).
   - ClearPath loads the saved active journey, displays the cache timestamp, and labels its displayed metrics **CACHED**.
6. **Test "Beyond the Brief": Motorcycle Mode (Yamaha XSR155)**:
   - In **Demo Lab** or journey settings, enable **"Motorcycle route"**.
   - ClearPath requests a motorcycle route from OneMap. It does not invent speed bands, clutch events, fatigue, time saved, or grip telemetry when those measurements are absent.

---

## 6. Deployment Architecture

- **Application (Google Cloud Run)**: The multi-stage `Dockerfile` builds the React frontend and packages it with the FastAPI backend in one production container on port 8080.
- **Frontend delivery**: FastAPI serves the compiled SPA and static assets from the same Cloud Run origin as `/api/*`, eliminating cross-origin configuration for the production application.
- **Database (Google Cloud Firestore)**: Stores commuter profiles, routines, notification preferences, and offline fallback route snapshots.

### Current Google Cloud Application

- **Project:** `qwiklabs-gcp-02-e3a0cea27f91`
- **Region:** `us-central1`
- **Cloud Run service:** `lta-nebula-x-hackathon`
- **Application URL:** `https://lta-nebula-x-hackathon-314751883323.us-central1.run.app`
- **Health check:** `https://lta-nebula-x-hackathon-314751883323.us-central1.run.app/api/health`

The Cloud Run revision uses the dedicated
`lta-nebula@qwiklabs-gcp-02-e3a0cea27f91.iam.gserviceaccount.com` runtime
identity and the `(default)` Firestore database in `us-central1`. LTA and
OneMap values must be supplied through Secret Manager; they are never included
in the source upload or browser bundle.

### Frontend-to-Backend Integration

The production React build uses same-origin `/api/*` requests. A public
`VITE_API_BASE_URL` override remains available for local frontend-only
development. DataMall and OneMap credentials stay inside Cloud Run and are
never sent to the browser.

FastAPI accepts and returns camelCase JSON so its profile, route, and
notification payloads match the TypeScript types. Route generation now runs on
the backend; there is no browser-generated routing fallback. Scenario controls are sent to `/api/proactive-check` as explicit
disruption, rain, and crowd simulation parameters.

`POST /api/routes` performs parameter-driven routing. It accepts an explicit
Singapore origin and destination, departure time, travel mode, maximum walking
distance, itinerary count, and comfort preferences. OneMap public-transport
legs or path geometry are normalized into the route/step contract used by the
React map. If OneMap is temporarily unavailable, the response is marked
`provider: "fallback"` and returns a coordinate-derived estimate instead of a
fixed demo journey. Proactive evaluations also send the current profile in the
request body, so newly edited journey parameters are used immediately.

### Metric Evidence and Fallback Labels

| Displayed value | Evidence shown in the app | Failure behavior |
|---|---|---|
| Route and leg duration/distance/geometry | `LIVE API` — OneMap Routing API | `ESTIMATE` — Haversine × 1.22, documented assumed speed, and transfer allowance |
| Departure time | `REFERENCE` — commuter profile | Remains the configured value |
| Arrival time | `DERIVED` — departure plus route duration | Uses the labeled estimated duration only on an Estimated Fallback Route |
| Crowd | `LIVE API` — LTA PCDForecast, or `SIMULATION` | `Unavailable`; no low-crowd assumption |
| Train disruption | `LIVE API` — LTA TrainServiceAlerts, or `SIMULATION` replay | Unknown/unavailable; no normal-service assertion |
| Weather | `LIVE API` — data.gov.sg area forecast, or `SIMULATION` | Unknown/unavailable; no dry-weather assertion |
| Shelter percentage | Shown only when supported by route data | `Unavailable`; a preference is not converted into a percentage |
| Motorcycle fatigue, grip, and clutch events | Not displayed without a validated sensor/model | `Unavailable` |
| Underground journey | `CACHED` with snapshot time | No claim that cached values are current |

The green shelter and cyan cycling lines are labeled **REFERENCE OVERLAY**. They are illustrative subsets, not a whole-island live feed, and are not used to calculate a shelter percentage.

For local frontend development, either retain the production API URL or set a
local override in the ignored `.env` file:

```dotenv
VITE_API_BASE_URL=http://localhost:8080
```

### Continuous Deployment

`cloudbuild.yaml` defines the production application pipeline. A push to `main`
builds React and FastAPI through the root multi-stage `Dockerfile`, publishes
the combined image to Artifact Registry, and deploys it to the
`lta-nebula-x-hackathon` Cloud Run service in `us-central1`. The deployment
uses the dedicated runtime identity above and preserves secrets managed by
Cloud Run and Secret Manager.
