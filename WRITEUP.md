# ClearPath — Architectural Write-Up and Persona Defense

## 1. Persona and problem fit

ClearPath is built for Arjun, a 29-year-old software engineer who travels from Waterway Terraces II in Punggol to Fusionopolis at one-north. His departure time is flexible, he sometimes carries a foldable bicycle, and he values predictability, lower crowding and protection from rain more than the theoretically fastest route.

The product makes one decision before he leaves: keep the original journey, take a separately calculated alternative, or wait for a better departure slot. It covers unplanned train disruption, crowd forecasts and weather, and it checks LTA planned road works, road openings and planned bus-route changes.

## 2. Architecture

- React, TypeScript, Leaflet and Tailwind provide a mobile-first map interface.
- FastAPI orchestrates OneMap, LTA DataMall and data.gov.sg.
- OneMap supplies route geometry, leg durations and distances.
- LTA DataMall supplies `TrainServiceAlerts`, `PCDForecast`, `BusArrival`, `TrafficSpeedBands`, `RoadWorks`, `RoadOpenings` and `PlannedBusRoutes`.
- data.gov.sg supplies the two-hour weather forecast.
- Firestore stores the commuter profile, latest offline journey and latest scheduled notification.
- Cloud Run serves the frontend and API from one origin.
- Cloud Scheduler calls an OIDC-protected endpoint every five minutes. The endpoint evaluates a profile only inside a ±2-minute window around its configured notification lead time.

The browser also stores the profile and most recent active journey in `localStorage`. The service worker caches the application shell, but deliberately leaves third-party basemap tiles to normal browser/network handling.

## 3. Decision logic

### Baseline

ClearPath requests a parameter-driven OneMap journey using the configured origin, destination, departure time, travel mode and maximum walking distance. The baseline remains in the response so the user can compare it with any recommendation.

### Train disruption

ClearPath parses nested `AffectedSegments`, including `FreePublicBus` and `FreeMRTShuttle`. When disruption is present, it makes a separate bus-only OneMap request. The alternative is recommended only if OneMap returns a route containing a bus and no MRT/LRT leg. Otherwise, the UI says that a rail-free alternative could not be verified and does not claim the disruption was avoided.

### Rain

For the judge-controlled heavy-rain scenario, the test value is explicitly labelled `SIMULATION`. ClearPath makes a separate bus request with a shorter maximum walking distance and recommends it only if OneMap returns a no-cycle route. It does not claim a sheltered percentage because OneMap does not measure covered-walkway exposure.

### Crowding

ClearPath queries `PCDForecast` at the scheduled time and again at the shifted time. It sends the shifted time through a second OneMap request. The shifted journey becomes recommended only if its crowd category is better and OneMap returned a live itinerary. No percentage reduction or guaranteed seat is claimed.

### Planned events

The backend retrieves live planned road works, planned road openings and planned bus routes. Events are shown with dates, locations and `LIVE API` evidence. A simple address-keyword screen marks possible journey relevance; the UI explicitly says this must be confirmed on the map rather than treating it as proven route intersection.

### Underground behavior

When tunnel mode is enabled or connectivity is lost, ClearPath loads the last active journey from browser storage, displays its saved time and labels it `CACHED`. Cached values are not described as current. A Firestore copy can provide cross-device recovery when the network is available again.

## 4. Visualization and accessibility

- The map remains the primary mobile surface.
- When a recommendation is selected, the original route remains visible as a grey dashed line while the recommended route uses mode-specific high-contrast styling.
- The comparison card presents time difference, changed mode or avoided segment and crowd comparison in text, so meaning does not depend on colour.
- Important controls are at least 44 by 44 CSS pixels and primary labels are at least 12px.
- The official OneMap basemap is used directly, with the required OneMap contributors and Singapore Land Authority attribution always visible.
- Onboarding explains the journey header, expandable route sheet and optional Demo Lab.

## 5. Evidence and reproducibility

| Displayed value | Evidence | Behavior when unavailable |
|---|---|---|
| Route geometry, duration and distance | OneMap Routing API | Clearly labelled coordinate-derived estimate |
| Arrival | Departure plus route duration | Uses the labelled estimate if OneMap failed |
| Crowd | LTA `PCDForecast` or judge simulation | `Unavailable`; no low-crowd assumption |
| Disruption | LTA `TrainServiceAlerts` or replay fixture | No normal-service assertion |
| Planned event | LTA planned-event endpoint | Section omitted when unavailable |
| Weather | data.gov.sg area forecast or judge simulation | Unknown; no dry-weather assertion |
| Offline journey | Saved local/Firestore snapshot | `CACHED` with timestamp |

The production application exposes `Sources & calculations` for route-level evidence. Simulation fixtures are visibly labelled and are not presented as live observations.

## 6. Privacy and retention

ClearPath stores the name, origin and destination addresses and coordinates, commute time, travel preferences, latest active journey and latest proactive notification. It does not collect payment information, contacts, continuous background location history or health information.

- Firestore profile: retained until the user selects **Delete my ClearPath data**.
- Firestore offline journey: overwritten whenever a new active route is saved and retained until deletion.
- Firestore notification: overwritten by the next scheduled notification and retained until deletion.
- Browser profile and journey: retained in `localStorage` until deletion or browser storage is cleared.
- In-memory local-development data: lasts only for the backend process.

The privacy control deletes the profile, offline route and notification from Firestore and clears ClearPath browser storage. Cloud Run uses an attached service account; no service-account JSON key is distributed.

## 7. Assumptions and limitations

1. OneMap returns point estimates, not a statistically calibrated journey-time range. The UI therefore states that live timing variability is unavailable.
2. Planned-event journey relevance uses text matching, not a full road-network intersection model.
3. CoveredLinkWay and cycling overlays are illustrative reference subsets and are not used to calculate percentages.
4. A bus-only OneMap route is not assumed to be an official bridging service. LTA mitigation text is displayed separately.
5. Motorcycle mode is standard OneMap road routing. ClearPath does not claim clutch events, wet grip, fatigue reduction, traffic-aware time savings or a safer road without measured evidence.
6. Quiet live feeds are demonstrated using clearly labelled replay/simulation controls.
7. Physical-device usability must be verified on the actual phone used for the pitch recording.

## 8. Source licences and attribution

- Map data and tiles: OneMap, with the required OneMap contributors and Singapore Land Authority attribution visible on the map.
- Transport data: LTA DataMall under its API terms and Singapore Open Data Licence conditions.
- Weather: data.gov.sg under the Singapore Open Data Licence.
- Routing: OneMap API, subject to OneMap terms.

No source dataset is redistributed as an unlabeled proprietary ClearPath measurement.
