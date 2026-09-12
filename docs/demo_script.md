# SIH 2026 Presentation & Demo Script — LINK X8

**Problem Statement ID:** SIH26002  
**Organization:** Ministry of Development of North Eastern Region (MDoNER)  
**Project Name:** LINK X8  
**Tagline:** Predict. Reroute. Deliver.  

---

## 3-Minute Live Hackathon Master Story

### 0:00 - 0:45 | Introduction & Problem Overview
- Open browser at `http://127.0.0.1:5173` on the **Logistics Command Center Dashboard**.
- Point out the top KPI cards: 3 Active Vehicles, 2 Active Deliveries, 0 High-Risk Corridors.
- Show vehicle `NER-V001` carrying emergency medical supplies from Guwahati to Imphal on the interactive GIS map. Status is **SAFE (LOW RISK 18/100)**.

### 0:45 - 1:30 | Field Incident & Instant GIS Update
- Click **"▶ Run SIH Demo (Landslide Scenario)"** on the top navigation bar.
- Explain: A field officer logs a massive monsoon landslide near Senapati Pass on NH27. Road status becomes **BLOCKED**.
- Show the GIS map updating instantly: A red incident alert marker appears, and the primary NH27 corridor turns red/dashed.

### 1:30 - 2:15 | AI Risk Engine & SHAP Explainability
- Navigate to **Route Risk AI** page.
- Show the ML prediction model output: Risk Score surges to **CRITICAL (82/100)**.
- Highlight the **Explainable AI** breakdown: 42% Landslide Blockage Proximity, 25% Heavy Monsoon Rainfall (75 mm/hr), 18% Elevation Gain (1850m).

### 2:15 - 3:00 | Alternate Route Recommendation & Logistics Decision
- Show the priority alert: `🚨 CRITICAL ROUTE ALERT: Switch vehicle NER-V001 to Alternate Route B (via Silchar / Jiribam - NH37)`.
- Click **"Approve Alternate Route B"**.
- Point out the revised ETA (+35 minutes delay) and show the truck trajectory shifting seamlessly to the safe alternate corridor on the Leaflet GIS map.
- Conclude: **"Predict. Reroute. Deliver."**
