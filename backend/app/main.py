from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.optimizer import optimize_portfolio
from app.analytics import analyze_portfolio
from app.config import CORS_ORIGINS
from app.market_data import MarketDataError, fetch_adjusted_prices
from app.schemas import AnalyzeRequest, AnalyzeResponse, ReportRequest
from fastapi.responses import Response
from pydantic import BaseModel, Field, model_validator
from app.report import build_report


app = FastAPI(
    title="QuantRisk",
    description="Portfolio risk analytics for NSE-listed equities.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "service": "quantrisk"}


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    try:
        prices = fetch_adjusted_prices(request.tickers, request.period)
        return analyze_portfolio(
            prices=prices,
            weights_pct=request.weights,
            period=request.period,
            risk_free_rate=request.risk_free_rate,
        )
    except MarketDataError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
class OptimizeRequest(AnalyzeRequest):
    max_weight_pct: float | None = Field(default=None, gt=0, le=100)

    @model_validator(mode="after")
    def validate_cap(self):
        if self.max_weight_pct is not None and len(self.tickers) * self.max_weight_pct < 100 - 1e-8:
            raise ValueError(
                f"A {self.max_weight_pct:g}% cap is too low for {len(self.tickers)} holdings. "
                f"Minimum feasible cap is {100 / len(self.tickers):.2f}%."
            )
        return self


@app.post("/api/optimize")
def optimize(request: OptimizeRequest) -> dict:
    try:
        prices = fetch_adjusted_prices(
            request.tickers,
            request.period
        )
        return optimize_portfolio(
            prices,
            request.risk_free_rate,
            max_weight=None if request.max_weight_pct is None else request.max_weight_pct / 100,
        )
    except (MarketDataError, ValueError) as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc)
        ) from exc   
   
@app.post("/api/report")
def export_report(request: ReportRequest):
    try:
        pdf = build_report(
            request.analysis,
            request.optimization
        )
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc)
        ) from exc

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="QuantRisk_Portfolio_Report.pdf"'
        }
    )
                