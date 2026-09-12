import urllib.request
import json

def test():
    # 1. Health
    res = json.loads(urllib.request.urlopen("http://127.0.0.1:8000/api/v1/health").read().decode())
    print("Health Status:", res.get("status"))

    # 2. Weather Health
    w_res = json.loads(urllib.request.urlopen("http://127.0.0.1:8000/api/v1/health/weather").read().decode())
    print("Weather Health:", w_res.get("status"), "Reachable:", w_res.get("reachable"), "Latency:", w_res.get("latency_ms"), "ms")

    # 3. Forecast
    fc = json.loads(urllib.request.urlopen("http://127.0.0.1:8000/api/v1/weather/forecast?lat=26.1445&lng=91.7362&location_name=Guwahati").read().decode())
    print("Forecast Location:", fc.get("location_name"), "Current Temp:", fc.get("current", {}).get("temperature_c"), "Risk Score:", fc.get("current", {}).get("weather_risk", {}).get("total_score"))

    # 4. Bridges
    brg = json.loads(urllib.request.urlopen("http://127.0.0.1:8000/api/v1/accessibility/bridges").read().decode())
    print("Total Monitored Bridges:", len(brg))
    for b in brg:
        print(f"  - [{b['status']}] {b['bridge_code']}: {b['name']} (Score: {b['accessibility_score']}/100, River: {b['river_name']})")

if __name__ == "__main__":
    test()
