from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health_reports_ok_and_orbitarium_version():
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["orbitarium_version"] == "2.0.0"
