# ClearPath — Proactive Commuter Companion
> **Singapore Problem Statement 2 (PS2) Challenge Submission**  
> Tailored specifically for **Arjun** (Multi-modal, flexible-start commuter travelling from Punggol to one-north).

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

> **Graceful Offline & Evaluation Fallback:**  
> If external API keys are not supplied, ClearPath seamlessly initializes with resilient verified offline baseline datasets and high-performance in-memory persistence. Judges can run and evaluate all features completely offline without spending any money or registering for external keys.

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

Follow this one real journey to test ClearPath end-to-end for **Arjun**:

1. **Launch App**: Open `http://localhost:3000`. The map immediately loads on the Punggol-to-one-north corridor with OpenStreetMap base tiles and the visible attribution `"© OpenStreetMap contributors"`.
2. **Observe Arjun's Default Journey**:
   - Arjun's scheduled commute is at **08:30 AM**.
   - The persistent Bottom Sheet displays his signature multi-modal itinerary:
     `Cycle (Punggol PCN: 2.1 km) → Damai LRT (PE7) → Punggol NEL → Circle Line → one-north (CC23) → CoveredLinkWay to Fusionopolis`.
3. **Simulate Train Disruption Replay**:
   - In the top toolbar, tap **"LRT Fault Replay"**.
   - ClearPath parses the nested `AffectedSegments` in LTA's `TrainServiceAlerts` feed and detects that LTA has activated `FreeMRTShuttle` and `FreePublicBus`.
   - The proactive banner immediately advises: *"Take Free MRT Shuttle from Punggol Interchange direct to Circle Line"*. Tap **"Accept Recommended Route"**.
   - Notice the map updates with amber mitigation routing and step badges indicating free boarding.
4. **Simulate Torrential Rain on Cycling Leg**:
   - Tap **"Torrential Rain"** (simulating 18.4 mm/h rain cell from data.gov.sg over Punggol).
   - ClearPath detects slip hazards and wet exposure on the cycling path.
   - The proactive engine advises: *"Shift departure to 08:50 or take CoveredLinkWay + Bus 84"*.
   - Tap **"Accept Recommended Route"** to engage the 94% sheltered route with bus seating prediction (`Load: SEA`).
5. **Simulate Underground / Loss of Cellular Signal**:
   - In the bottom sheet, tap **"Simulate Tunnel"** (or switch your phone to Airplane Mode).
   - ClearPath detects the network drop, switches seamlessly to the `localStorage` and Service Worker cached active journey, displays the cached timestamp, and provides offline station concourse instructions.
6. **Test "Beyond the Brief": Motorcycle Mode (Yamaha XSR155)**:
   - In the top toolbar or user profile, tap **"Motorcycle Mode"**.
   - ClearPath evaluates LTA's `v4/TrafficSpeedBands` across expressways.
   - It detects Speed Band 1 (8-18 km/h stop-and-go) along the PIE Westbound near Adam Road.
   - ClearPath proactively routes the rider via **Bartley Viaduct & Lornie Highway (Speed Band 6: 65 km/h)**, saving 13 minutes and eliminating >80 stop-and-go clutch modulations to prevent rider fatigue and wet road-marking slip hazards!

---

## 6. Deployment Architecture

- **Backend (Google Cloud Run)**: The provided `Dockerfile` builds a production-ready containerized service exposing port 8080 with Uvicorn worker threads.
- **Frontend (Firebase Hosting)**: The provided `firebase.json` defines SPA client routing rewrites to `/index.html` and aggressive caching headers for static assets while keeping the Service Worker (`/sw.js`) fresh.
- **Database (Google Cloud Firestore)**: Stores commuter profiles, routines, notification preferences, and offline fallback route snapshots.

### Current Google Cloud Backend

- **Project:** `qwiklabs-gcp-02-e3a0cea27f91`
- **Region:** `us-central1`
- **Cloud Run service:** `lta-nebula-x-hackathon`
- **API base URL:** `https://lta-nebula-x-hackathon-314751883323.us-central1.run.app`
- **Health check:** `https://lta-nebula-x-hackathon-314751883323.us-central1.run.app/api/health`

The Cloud Run revision uses the dedicated
`lta-nebula@qwiklabs-gcp-02-e3a0cea27f91.iam.gserviceaccount.com` runtime
identity and the `(default)` Firestore database in `us-central1`. LTA and
OneMap values must be supplied through Secret Manager; they are never included
in the source upload or browser bundle.

### Frontend-to-Backend Integration

The React application reads the public `VITE_API_BASE_URL` value from
`.env.production` and sends all live LTA, weather, profile, offline-cache, and
proactive-evaluation requests to FastAPI. DataMall and OneMap credentials stay
inside Cloud Run and are never sent to the browser.

FastAPI accepts and returns camelCase JSON so its profile, route, and
notification payloads match the TypeScript types. Route generation now runs on
the backend, with the former browser routing engine retained only as an offline
fallback. Scenario controls are sent to `/api/proactive-check` as explicit
disruption, rain, and crowd simulation parameters.

For local frontend development, either retain the production API URL or set a
local override in the ignored `.env` file:

```dotenv
VITE_API_BASE_URL=http://localhost:8080
```

### Continuous Deployment

`cloudbuild.yaml` defines the production backend pipeline. A push to `main`
builds the root `Dockerfile`, publishes the image to Artifact Registry, and
deploys it to the `lta-nebula-x-hackathon` Cloud Run service in `us-central1`.
The deployment uses the dedicated runtime identity above and preserves secrets
managed by Cloud Run and Secret Manager.
