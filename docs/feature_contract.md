# Feature Contract Specification — LINK X8

**Version:** 1.0.0  
**Model Compatibility:** v1.0.0  

## Feature Order & Specification

| Feature Name | Data Type | Required | Min | Max | Default | Description |
|---|---|---|---|---|---|---|
| `distance_km` | float | Yes | 1.0 | 2000.0 | 150.0 | Total corridor distance in kilometers |
| `terrain_elevation_gain_m` | float | Yes | 0.0 | 5000.0 | 800.0 | Cumulative elevation gain along mountain pass |
| `rainfall_mm_hr` | float | Yes | 0.0 | 300.0 | 10.0 | Precipitation intensity in mm/hr |
| `active_incidents_count` | integer | Yes | 0 | 20 | 0 | Count of active field incidents on corridor |
| `highest_severity_numeric` | integer | Yes | 0 | 4 | 0 | Max incident severity (0: None, 1: Low, 2: Med, 3: High, 4: Critical) |
| `road_blocked_status` | integer | Yes | 0 | 1 | 0 | 1 if any road segment is impassable, else 0 |
| `historical_landslide_freq` | float | Yes | 0.0 | 1.0 | 0.2 | Historical landslide occurrence index (0.0 to 1.0) |
| `traffic_congestion_index` | float | Yes | 0.0 | 1.0 | 0.3 | Congestion level (0.0 clear to 1.0 standstill) |

## Validation Protocol
All inference payloads submitted to `/api/v1/ml/predict` or `/api/v1/routes/analyze` are automatically checked against this contract before feature vector serialization. Missing optional values are populated using safe defaults, and out-of-bound numerical values are clipped gracefully.
