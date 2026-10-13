import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.database import get_db, SessionLocal
from app.database.seed import seed_database

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    seed_database()

def test_assistant_health():
    response = client.get("/api/v1/assistant/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ONLINE"
    assert data["assistant"] == "Assistant 88"
    assert "data_indices" in data

def test_assistant_quick_actions():
    response = client.get("/api/v1/assistant/quick-actions")
    assert response.status_code == 200
    actions = response.json()
    assert len(actions) >= 5
    labels = [a["label"] for a in actions]
    assert "Network Status" in labels or "Restricted Corridors" in labels
    assert "Weather Risk" in labels

def test_assistant_regional_summary():
    payload = {
        "message": "Summarize today's major logistics risks in NER.",
        "context": {}
    }
    response = client.post("/api/v1/assistant/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "NER88 Regional Logistics Risk Summary" in data["message"]
    assert "DATABASE" in data["sources"]
    assert len(data["recommendations"]) > 0

def test_assistant_current_time():
    payload = {
        "message": "What is the current time in Kohima?",
        "context": {}
    }
    response = client.post("/api/v1/assistant/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "IST" in data["message"]
    assert "Kohima" in data["message"]
    assert "SYSTEM_CLOCK_IST" in data["sources"]

def test_assistant_general_factual():
    payload = {
        "message": "What is the capital of Nagaland?",
        "context": {}
    }
    response = client.post("/api/v1/assistant/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "Kohima" in data["message"]
    assert "Nagaland" in data["message"]

def test_assistant_blocked_corridors():
    payload = {
        "message": "Which corridors are blocked?",
        "context": {}
    }
    response = client.post("/api/v1/assistant/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "corridor" in data["message"].lower()

def test_assistant_context_aware_query():
    payload = {
        "message": "Why is the accessibility score low here?",
        "context": {
            "district": "Senapati",
            "state": "Manipur"
        }
    }
    response = client.post("/api/v1/assistant/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "Senapati" in data["message"]
    assert "Accessibility Index" in data["message"]
    assert "ACCESSIBILITY_ENGINE" in data["sources"]

def test_assistant_weather_query():
    payload = {
        "message": "Which areas have rainfall or weather risks?",
        "context": {}
    }
    response = client.post("/api/v1/assistant/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "Weather" in data["message"] or "Rainfall" in data["message"]
