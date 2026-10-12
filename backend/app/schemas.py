import re
from typing import List, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.config import (
    ALLOWED_PERIODS,
    DEFAULT_PERIOD,
    DEFAULT_TICKERS,
    MAX_HOLDINGS,
    MIN_HOLDINGS,
    WEIGHT_SUM_TOLERANCE,
)


PeriodLiteral = Literal["6mo", "1y", "2y", "5y", "10y", "max"]


class AnalyzeRequest(BaseModel):
    tickers: List[str] = Field(default_factory=lambda: list(DEFAULT_TICKERS))
    weights: List[float] = Field(
        default_factory=lambda: [100.0 / len(DEFAULT_TICKERS)] * len(DEFAULT_TICKERS),
        description="Portfolio weights in percent; must sum to 100.",
    )
    period: PeriodLiteral = DEFAULT_PERIOD
    risk_free_rate: float = Field(
        default=0.065,
        ge=0.0,
        le=0.25,
        description="Annual risk-free rate as a decimal (e.g. 0.065 for 6.5%).",
    )

    @field_validator("tickers")
    @classmethod
    def normalize_tickers(cls, tickers: List[str]) -> List[str]:
        cleaned = [t.strip().upper() for t in tickers if t and t.strip()]
        if not (MIN_HOLDINGS <= len(cleaned) <= MAX_HOLDINGS):
            raise ValueError(
                f"Select between {MIN_HOLDINGS} and {MAX_HOLDINGS} tickers."
            )
        if len(set(cleaned)) != len(cleaned):
            raise ValueError("Tickers must be unique.")
        ticker_pattern = re.compile(r"^[A-Z0-9][A-Z0-9.&-]*\.[A-Z]{1,4}$")
        for ticker in cleaned:
            if not ticker_pattern.match(ticker):
                raise ValueError(
                    f"Invalid ticker '{ticker}'. Use Yahoo Finance symbols such as RELIANCE.NS."
                )
        return cleaned

    @field_validator("period")
    @classmethod
    def check_period(cls, period: str) -> str:
        if period not in ALLOWED_PERIODS:
            raise ValueError(f"Period must be one of: {', '.join(ALLOWED_PERIODS)}.")
        return period

    @model_validator(mode="after")
    def check_weights(self) -> "AnalyzeRequest":
        if len(self.weights) != len(self.tickers):
            raise ValueError("Provide exactly one weight for each ticker.")
        if any(w <= 0 for w in self.weights):
            raise ValueError("Each weight must be greater than 0%.")
        total = float(sum(self.weights))
        if abs(total - 100.0) > WEIGHT_SUM_TOLERANCE * 100:
            raise ValueError(
                f"Weights must sum to 100% (currently {total:.2f}%)."
            )
        return self


class MetricSet(BaseModel):
    annualized_return: float
    annualized_volatility: float
    sharpe_ratio: float
    max_drawdown: float
    var_95_1d: float


class SeriesPoint(BaseModel):
    date: str
    value: float


class AnalyzeResponse(BaseModel):
    tickers: List[str]
    weights: List[float]
    period: str
    risk_free_rate: float
    start_date: str
    end_date: str
    observation_count: int
    trading_days_per_year: int
    metrics: MetricSet
    cumulative: List[SeriesPoint]
    drawdown: List[SeriesPoint]
    assumptions: List[str]
    disclaimer: str


class ReportRequest(BaseModel):
    analysis: AnalyzeResponse
    optimization: dict | None = None

