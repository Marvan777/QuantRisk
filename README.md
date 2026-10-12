# QuantRisk

Portfolio risk analysis for NSE-listed equities. Select two to five Yahoo Finance tickers, set constant weights, and review historical return, volatility, Sharpe ratio, drawdown, and one-day 95% Value at Risk.

This is a demonstration platform for quantitative finance and software engineering. It does not provide investment advice and does not forecast future returns.

## What it computes

| Statistic | Definition |
| --- | --- |
| Daily portfolio return | Weighted sum of daily simple returns, with **constant target weights and daily rebalancing** |
| Annualized historical return | Geometric (compounded) rate using **252** trading days per year |
| Annualized volatility | Sample standard deviation of daily portfolio returns × √252 |
| Sharpe ratio | (Arithmetic annualized return − stated risk-free rate) / annualized volatility |
| Maximum drawdown | Largest peak-to-trough decline of the compounded wealth index |
| 1-day 95% VaR | Historical empirical 5th percentile of daily returns, reported as a **positive loss** |

Prices are Yahoo Finance **adjusted closes**. Series are inner-joined by date so every observation includes all holdings. The risk-free rate is a user input (for example a T-bill or repo proxy); it is not downloaded.

## Project layout

```
QuantRisk/
  backend/     FastAPI, Pandas, NumPy, SciPy, yfinance
  frontend/    React, Vite, Tailwind CSS, Recharts
```

Do **not** install into or modify the existing root `.venv` directory. Create a separate environment under `backend\.venv`.

## Windows PowerShell setup

Requires Python 3.11+ and Node.js 18+.

```powershell
Set-Location C:\Users\marva\QuantRisk

# --- Backend ---
python -m venv backend\.venv
backend\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
Set-Location backend
uvicorn app.main:app --reload --port 8000
```

In a **second** PowerShell window:

```powershell
Set-Location C:\Users\marva\QuantRisk\frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite proxies `/api` to `http://127.0.0.1:8000`. CORS also allows the Vite origin if you call the API directly.

If script execution is blocked:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## Tests and build

```powershell
# Backend unit tests (synthetic prices; no live market download)
Set-Location C:\Users\marva\QuantRisk\backend
..\backend\.venv\Scripts\Activate.ps1   # or: backend\.venv\Scripts\Activate.ps1 from repo root
pytest

# Frontend production build
Set-Location C:\Users\marva\QuantRisk\frontend
npm run build
```

API tests mock `fetch_adjusted_prices`. The running application always uses **live yfinance** data.

## API

`POST /api/analyze`

```json
{
  "tickers": ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS"],
  "weights": [25, 25, 25, 25],
  "period": "2y",
  "risk_free_rate": 0.065
}
```

`period` must be one of `6mo`, `1y`, `2y`, `5y`, `10y`, `max`. Weights are percents and must sum to 100. `GET /api/health` reports process liveness.

## Design notes

The dashboard is a working risk desk: charcoal and navy surfaces, muted green for constructive figures, rust for losses, IBM Plex for type. Phase two (mean-variance optimization) is intentionally omitted.
