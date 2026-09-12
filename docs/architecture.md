# System Architecture — LINK X8 (SIH26002)

## Overview
LINK X8 is a Smart Logistics and Accessibility Intelligence Platform built for the Ministry of Development of North Eastern Region (MDoNER). It connects field incident reports, weather telemetry, machine learning risk models, and interactive GIS routing into an integrated logistics command center.

## Core Data Pipeline
```
[ FIELD REPORTS / WEATHER ]
             │
             ▼
    [ FASTAPI CORE API ] ◄──► [ SQLITE DB / POSTGRES ]
             │
             ▼
   [ AI ROUTE RISK ENGINE ]
   (Random Forest Classifier & Regressor + Feature Contract)
             │
             ▼
[ ROUTE OPTIMIZER & ETA CALCULATOR ]
             │
             ▼
  [ OPERATIONAL ALERT ENGINE ]
             │
             ▼
 [ REACT + VITE GIS DASHBOARD ]
```

## Security & Access Control
- JWT Bearer Authentication (`HS256`).
- Role-Based Access Control (RBAC):
  - **Admin**: Full system configuration, user management, audit logs.
  - **Dispatcher**: Shipment creation, vehicle assignment, reroute approvals, alerts.
  - **Field Officer**: Mobile-friendly offline field report queue and sync.
  - **Viewer**: Read-only GIS dashboard and analytics monitoring.
