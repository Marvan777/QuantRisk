from datetime import datetime

import pandas as pd
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _synthetic_prices() -> pd.DataFrame:
    dates = pd.bdate_range("2023-01-02", periods=80)
    n = len(dates)
    t = pd.Series(range(n), index=dates, dtype=float)
    return pd.DataFrame(
        {
            "RELIANCE.NS": 100 * (1.0004 ** t) + 0.2 * (t % 7),
            "TCS.NS": 200 * (1.0003 ** t) + 0.15 * ((t + 2) % 5),
            "INFY.NS": 150 * (1.00035 ** t) - 0.1 * (t % 4),
            "HDFCBANK.NS": 80 * (1.00025 ** t) + 0.05 * (t % 9),
        },
        index=dates,
    )


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_analyze_rejects_weight_sum_not_100():
    payload = {
        "tickers": ["RELIANCE.NS", "TCS.NS"],
        "weights": [40.0, 40.0],
        "period": "1y",
        "risk_free_rate": 0.065,
    }
    response = client.post("/api/analyze", json=payload)
    assert response.status_code == 422


def test_analyze_rejects_single_ticker():
    payload = {
        "tickers": ["RELIANCE.NS"],
        "weights": [100.0],
        "period": "1y",
        "risk_free_rate": 0.065,
    }
    response = client.post("/api/analyze", json=payload)
    assert response.status_code == 422


def test_analyze_success_with_mocked_prices(monkeypatch):
    prices = _synthetic_prices()

    def fake_fetch(tickers, period):
        return prices[tickers]

    monkeypatch.setattr("app.main.fetch_adjusted_prices", fake_fetch)

    payload = {
        "tickers": ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS"],
        "weights": [25.0, 25.0, 25.0, 25.0],
        "period": "1y",
        "risk_free_rate": 0.065,
    }
    response = client.post("/api/analyze", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["observation_count"] == 79
    assert body["trading_days_per_year"] == 252
    assert len(body["cumulative"]) == 79
    assert len(body["drawdown"]) == 79
    assert set(body["metrics"]) == {
        "annualized_return",
        "annualized_volatility",
        "sharpe_ratio",
        "max_drawdown",
        "var_95_1d",
    }
    datetime.strptime(body["start_date"], "%Y-%m-%d")
    datetime.strptime(body["end_date"], "%Y-%m-%d")
    assert body["metrics"]["max_drawdown"] <= 0
    assert "daily rebalancing" in " ".join(body["assumptions"]).lower()
