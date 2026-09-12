# REST API Documentation — LINK X8

Base URL: `http://127.0.0.1:8000/api/v1`

## Endpoints Summary

### Authentication (`/auth`)
- `POST /auth/login` — Authenticates user email/password, returns JWT token & role.
- `POST /auth/register` — Registers new platform user with specified role.

### Dashboard (`/dashboard`)
- `GET /dashboard/summary` — Returns top KPI counts, risk distribution breakdown, recent incidents, and priority alerts.

### Vehicles (`/vehicles`)
- `GET /vehicles` — Lists all fleet vehicles with live GPS coordinates, status, and driver details.
- `POST /vehicles` — Registers a new vehicle in fleet.

### Deliveries (`/deliveries`)
- `GET /deliveries` — Lists all shipments with origin/destination, risk score, ETA, and delay.
- `POST /deliveries` — Creates and dispatches a new delivery.
- `POST /deliveries/{id}/reroute` — Approves alternate route recommendation, recalculating ETA and active route path.

### Incidents (`/incidents`)
- `GET /incidents` — Lists all active field incidents and road blockages.
- `POST /incidents` — Reports a new incident, triggering real-time GIS map updates and AI risk surge.

### Offline Field Reports (`/field-reports`)
- `GET /field-reports` — Lists field officer reports.
- `POST /field-reports/sync` — Synchronizes batch of offline field reports logged in browser IndexedDB/LocalStorage.

### Route Risk & Explainable AI (`/routes` & `/ml`)
- `POST /routes/analyze` — Evaluates corridor parameters against the Random Forest ML model, returning SHAP-based feature importance explainability and GeoJSON route geometry.
- `GET /ml/metadata` — Model version, evaluation accuracy (92.0%), and feature weight metrics.
- `GET /ml/feature-contract` — Feature contract parameters and numerical bounds.

### SIH Hackathon Demo Trigger (`/demo`)
- `POST /demo/trigger-landslide` — Executes the 3-minute hackathon master scenario (Landslide report -> AI Risk 82/100 -> Alternate Route B -> ETA delay +35m -> Alert).
- `POST /demo/reset` — Resets state back to clear initial baseline.
