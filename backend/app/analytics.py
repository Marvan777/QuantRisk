from typing import Dict, List

import numpy as np
import pandas as pd
from scipy.stats import scoreatpercentile

from app.config import TRADING_DAYS_PER_YEAR, VAR_CONFIDENCE
from app.schemas import AnalyzeResponse, MetricSet, SeriesPoint

ASSUMPTIONS = [
    "Prices are Yahoo Finance adjusted closes (splits and dividends).",
    "Daily simple returns use consecutive adjusted closes: P_t / P_{t-1} - 1.",
    "Portfolio returns assume constant target weights and daily rebalancing.",
    "Stock histories are inner-joined by date so every day includes all holdings.",
    f"Annualization uses {TRADING_DAYS_PER_YEAR} Indian equity trading days.",
    "Annualized historical return is the geometric (compounded) rate from daily portfolio returns.",
    "Annualized volatility is the sample standard deviation of daily portfolio returns, times sqrt(252).",
    "Sharpe ratio uses arithmetic mean excess return versus the stated annual risk-free rate.",
    "Maximum drawdown is the largest peak-to-trough decline of the compounded wealth index.",
    "One-day 95% VaR is the historical empirical 5th percentile of daily portfolio returns, reported as a positive loss.",
    "Results describe the selected historical sample only. They are not a forecast or guarantee.",
]

DISCLAIMER = (
    "Historical risk statistics are not predictions of future performance. "
    "This tool is for education and demonstration, not investment advice."
)


def analyze_portfolio(
    prices: pd.DataFrame,
    weights_pct: List[float],
    period: str,
    risk_free_rate: float,
) -> AnalyzeResponse:
    if prices.shape[1] != len(weights_pct):
        raise ValueError("Number of price columns must match the number of weights.")

    weights = np.array(weights_pct, dtype=float) / 100.0
    asset_returns = prices.pct_change().dropna(how="any")
    if asset_returns.empty:
        raise ValueError("Unable to compute returns from the aligned price series.")

    portfolio_returns = asset_returns.to_numpy(dtype=float) @ weights
    portfolio = pd.Series(portfolio_returns, index=asset_returns.index, name="portfolio")

    wealth = (1.0 + portfolio).cumprod()
    running_peak = wealth.cummax()
    drawdown = wealth / running_peak - 1.0

    n = len(portfolio)
    mean_daily = float(portfolio.mean())
    std_daily = float(portfolio.std(ddof=1))
    total_compounded = float(wealth.iloc[-1] / 1.0)
    annualized_return = float(total_compounded ** (TRADING_DAYS_PER_YEAR / n) - 1.0)
    annualized_vol = float(std_daily * np.sqrt(TRADING_DAYS_PER_YEAR))
    annualized_arithmetic = mean_daily * TRADING_DAYS_PER_YEAR
    sharpe = (
        float((annualized_arithmetic - risk_free_rate) / annualized_vol)
        if annualized_vol > 0
        else float("nan")
    )
    max_drawdown = float(drawdown.min())
    var_quantile = float(
        scoreatpercentile(portfolio.to_numpy(), 100.0 * (1.0 - VAR_CONFIDENCE))
    )
    var_95_1d = float(-var_quantile)

    dates = [d.strftime("%Y-%m-%d") for d in wealth.index]
    cumulative_points = [
        SeriesPoint(date=date, value=float(value))
        for date, value in zip(dates, wealth.to_numpy())
    ]
    drawdown_points = [
        SeriesPoint(date=date, value=float(value))
        for date, value in zip(dates, drawdown.to_numpy())
    ]

    return AnalyzeResponse(
        tickers=list(prices.columns),
        weights=[float(w) for w in weights_pct],
        period=period,
        risk_free_rate=risk_free_rate,
        start_date=prices.index[0].strftime("%Y-%m-%d"),
        end_date=prices.index[-1].strftime("%Y-%m-%d"),
        observation_count=n,
        trading_days_per_year=TRADING_DAYS_PER_YEAR,
        metrics=MetricSet(
            annualized_return=annualized_return,
            annualized_volatility=annualized_vol,
            sharpe_ratio=sharpe,
            max_drawdown=max_drawdown,
            var_95_1d=var_95_1d,
        ),
        cumulative=cumulative_points,
        drawdown=drawdown_points,
        assumptions=ASSUMPTIONS,
        disclaimer=DISCLAIMER,
    )


def metrics_as_dict(response: AnalyzeResponse) -> Dict[str, float]:
    return response.metrics.model_dump()
