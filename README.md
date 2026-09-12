# LINK X8 — Smart Logistics and Accessibility Intelligence Platform

**Smart India Hackathon 2026 Prototype**  
**Problem Statement ID:** SIH26002  
**Official Problem Statement:** AI-Based Smart Logistics and Accessibility Intelligence Platform for North Eastern Region (NER)  
**Organization:** Ministry of Development of North Eastern Region (MDoNER)  
**Category:** Software  
**Theme:** Transportation & Logistics  

### Tagline
**Predict. Reroute. Deliver.**

> 📖 **Master Project & Feature Specification**: Full project background, exhaustive feature catalog, ERD schemas, AI ML model pipeline specs, and API contracts are available in [`LINK_X8_MASTER_DOCUMENTATION.md`](file:///c:/Users/Naren/Downloads/newai/ner-logiai/LINK_X8_MASTER_DOCUMENTATION.md) and [`FULL_STACK_DOCUMENTATION.md`](file:///c:/Users/Naren/Downloads/newai/ner-logiai/FULL_STACK_DOCUMENTATION.md).

---

## 1. Project Overview & Problem Statement
The North Eastern Region (NER) of India faces distinct geographical, terrain, and monsoon challenges including landslides, flash flooding, narrow mountain passes, and single-lane highway corridors. Freight transportation, critical medical supplies, and disaster relief goods frequently experience unexpected multi-hour disruptions.

**LINK X8** is a Smart Logistics and Accessibility Intelligence Platform designed to monitor accessibility, analyze real-time conditions, identify disruptions, and support intelligent logistics and route decisions. It integrates:
- Interactive GIS Map route tracking using OpenStreetMap and Leaflet.
- AI Route Risk Engine trained on NER logistics disruption data.
- SHAP-based Explainable AI detailing feature contribution weights.
- Automatic Alternative Route finder and revised ETA delay calculation.
- Offline-first mobile field reporting queue with background synchronization.
- Role-Based Access Control (Admin, Dispatcher, Field Officer, Viewer).

---

## 2. Technology Stack
- **Frontend:** React, Vite, Tailwind CSS, Leaflet / React-Leaflet, Lucide React Icons, Recharts, Axios.
- **Backend:** Python, FastAPI, SQLAlchemy 2.0, Pydantic v2, Uvicorn, SQLite database (PostgreSQL / PostGIS schema compatible).
- **AI/ML:** Python, Scikit-Learn (Random Forest Ensemble), Pandas, NumPy, Joblib, SHAP feature weights.
- **Security:** JWT authentication (`HS256`), bcrypt password hashing, Role-Based Access Control.

---

## 3. Quick Start Setup Instructions

### Prerequisites
- Node.js (v18+) & npm
- Python (v3.10+)

### 1. Configure Environment Variables
- **Frontend**: `frontend/.env`
  ```env
  VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
  ```
- **Backend**: `backend/.env` (optional, defaults provided in `backend/app/core/config.py`)

### 2. Install Dependencies
```bash
# Backend dependencies
pip install -r backend/requirements.txt

# Frontend dependencies
cd frontend && npm install && cd ..
```

### 3. Launch FastAPI Backend
From the project root:
```bash
python -m uvicorn app.main:app --app-dir backend --reload --host 0.0.0.0 --port 8000
```
Or via npm root script:
```bash
npm run backend
```
- **Backend API Base**: `http://127.0.0.1:8000/api/v1`
- **Swagger Documentation**: `http://127.0.0.1:8000/docs`
- **Root Health Check**: `http://127.0.0.1:8000/health`
- **API Health Check**: `http://127.0.0.1:8000/api/v1/health`
- **Weather Service Health Check**: `http://127.0.0.1:8000/api/v1/health/weather`

### 4. Launch React Frontend
In a new terminal:
```bash
npm run dev
```
(or `cd frontend && npm run dev`)
- **Frontend URL**: `http://127.0.0.1:5173`

### 5. Verify System Health & Troubleshooting
1. **Verify Backend Health**:
   ```bash
   curl http://127.0.0.1:8000/api/v1/health
   curl http://127.0.0.1:8000/api/v1/health/weather
   ```
2. **Troubleshooting Connection Issues**:
   - **"Weather service temporarily unavailable"**: Verify FastAPI is running on port 8000 (`http://127.0.0.1:8000`). Click "Retry Weather Request" or "Reconnect" in the dashboard.
   - **"Showing 0 Bridges"**: Ensure backend is running and seeded. Check `http://127.0.0.1:8000/api/v1/accessibility/bridges`. The dashboard displays a live reconnect button if the backend was offline when the page loaded.
   - **CORS Issues**: Ensure the frontend is running on `http://127.0.0.1:5173` or `http://localhost:5173`. FastAPI CORS is pre-configured for all local origins.

---

## 4. Default Demo Login Credentials
| Role | Email Address | Password |
|---|---|---|
| **Admin** | `admin@linkx8.in` | `Admin@123` |
| **Dispatcher** | `dispatcher@linkx8.in` | `Dispatch@123` |
| **Field Officer** | `field@linkx8.in` | `Field@123` |
| **Viewer** | `viewer@linkx8.in` | `Viewer@123` |

---

## 5. Master 3-Minute Hackathon Demo Scenario
To run the master demonstration:
1. Open `http://127.0.0.1:5173` in your browser.
2. Click **"▶ Run SIH Demo (Landslide Scenario)"** on the top navigation bar.
3. Observe the full 7-step automated story:
   - `FIELD INCIDENT (Landslide at Senapati)` ➔ `GIS MAP UPDATE` ➔ `AI RISK SURGE (82/100 CRITICAL)` ➔ `ALTERNATE ROUTE B (NH37 via Silchar)` ➔ `REVISED ETA (+35m delay)` ➔ `DISPATCHER ALERT` ➔ `REROUTE APPROVAL`.

---

## 6. Data Honesty & Transparency Declaration
This project strictly follows SIH data honesty guidelines:
- Weather telemetry and GPS movements are explicitly tagged with `[SIMULATED DEMO DATA]` and `[SIMULATED GPS]` badges.
- ML metrics are derived directly from empirical training on `ml/data/ner_logistics_dataset.csv`.
- System threshold ranges are configurable prototype configuration values.

---

## 7. Limitations & Future Enhancements
- **Future Integration:** Direct integration with official MDoNER road feeds, real IoT GPS hardware dongles, satellite radar feeds, and native Indian language voice notifications.

---

## License & Acknowledgements
Developed for Smart India Hackathon 2026 (SIH26002).  
Ministry of Development of North Eastern Region (MDoNER), Government of India.
