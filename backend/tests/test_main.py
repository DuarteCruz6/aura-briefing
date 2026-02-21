"""
API route tests. Run from repo root: pytest backend/tests -v
"""
import pytest


def test_root(client):
    r = client.get("/")
    assert r.status_code == 200
    data = r.json()
    assert "service" in data
    assert "docs" in data
    assert data["docs"] == "/docs"
    assert "health" in data
    assert "tables" in data


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_tables(client):
    r = client.get("/tables")
    assert r.status_code == 200
    data = r.json()
    assert "tables" in data
    assert isinstance(data["tables"], dict)


def test_summaries_by_url_not_found(client):
    r = client.get("/summaries/by-url", params={"url": "https://example.com/no-summary"})
    assert r.status_code == 404
    assert "detail" in r.json()


def test_summaries_get_or_extract_missing_url(client):
    r = client.post("/summaries/get-or-extract", json={})
    assert r.status_code == 422  # validation error


def test_summaries_get_or_extract_empty_url(client):
    r = client.post("/summaries/get-or-extract", json={"url": "   "})
    assert r.status_code == 400
    assert "url" in (r.json().get("detail") or "").lower()


def test_multi_url_empty(client):
    r = client.post("/summaries/multi-url", json={"urls": []})
    assert r.status_code == 400
    assert "urls" in (r.json().get("detail") or "").lower()
