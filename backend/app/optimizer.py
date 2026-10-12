"""Long-only historical mean-variance optimization for QuantRisk."""

import numpy as np
import pandas as pd
from scipy.optimize import minimize

TRADING_DAYS = 252


def optimize_portfolio(prices: pd.DataFrame, risk_free_rate: float = 0.065, max_weight: float | None = None) -> dict:
    if prices.shape[1] < 2 or len(prices) < 31:
        raise ValueError("At least two assets and 30 daily returns are required.")
    if not np.isfinite(risk_free_rate):
        raise ValueError("Risk-free rate must be finite.")

    returns = prices.pct_change(fill_method=None).dropna(how="any")
    if len(returns) < 30 or not np.isfinite(returns.to_numpy()).all():
        raise ValueError("Insufficient valid aligned return observations.")

    n = len(returns.columns)
    if max_weight is not None:
        if not np.isfinite(max_weight) or not (0 < max_weight <= 1):
            raise ValueError("Maximum allocation must be greater than 0% and at most 100%.")
        if n * max_weight < 1 - 1e-10:
            raise ValueError(
                f"A {max_weight * 100:g}% stock cap requires at least "
                f"{int(np.ceil((1 - 1e-10) / max_weight))} holdings. "
                "Increase the cap, add holdings, or disable it."
            )
    mu = returns.mean().to_numpy(dtype=float) * TRADING_DAYS
    cov = returns.cov().to_numpy(dtype=float) * TRADING_DAYS
    if not np.isfinite(mu).all() or not np.isfinite(cov).all():
        raise ValueError("Invalid return statistics.")
    cov = (cov + cov.T) / 2

    limit = 1.0 if max_weight is None else max_weight
    bounds = [(0.0, limit)] * n
    total_weight = {"type": "eq", "fun": lambda w: np.sum(w) - 1.0}
    equal = np.full(n, 1.0 / n)
    # Construct cap-feasible high-return corner portfolios (unit vectors are invalid under a cap).
    corners = []
    for ranked_first in range(n):
        order = [ranked_first, *[j for j in np.argsort(-mu) if j != ranked_first]]
        corner = np.zeros(n)
        remaining = 1.0
        for j in order:
            amount = min(limit, remaining)
            corner[j] = amount
            remaining -= amount
            if remaining <= 1e-12:
                break
        corners.append(corner)

    def variance(w):
        return float(w @ cov @ w)

    def stats(w):
        ret = float(w @ mu)
        vol = float(np.sqrt(max(variance(w), 0.0)))
        sharpe = (ret - risk_free_rate) / vol if vol > 1e-12 else None
        return ret, vol, sharpe

    def solve(objective, constraints, starts):
        candidates = []
        for start in starts:
            result = minimize(
                objective, start, method="SLSQP", bounds=bounds,
                constraints=constraints,
                options={"ftol": 1e-11, "maxiter": 2000},
            )
            w = np.asarray(result.x, dtype=float)
            if not result.success or not np.isfinite(w).all():
                continue
            if abs(w.sum() - 1) > 1e-5 or w.min() < -1e-6 or w.max() > limit + 1e-6:
                continue
            if any(abs(float(c["fun"](w))) > 1e-5 for c in constraints if c["type"] == "eq"):
                continue
            # Do not renormalize here: that can push a weight beyond the cap.
            w = np.clip(w, 0.0, limit)
            if abs(w.sum() - 1.0) > 1e-5:
                continue
            value = float(objective(w))
            if np.isfinite(value):
                candidates.append((value, w))
        if not candidates:
            raise ValueError("Portfolio optimization failed to find a feasible solution.")
        return min(candidates, key=lambda item: item[0])[1]

    minimum = solve(variance, [total_weight], [equal, *corners])

    def negative_sharpe(w):
        sharpe = stats(w)[2]
        return -sharpe if sharpe is not None else 1e12

    # Multiple starts are especially important when all Sharpe ratios are negative.
    maximum = solve(negative_sharpe, [total_weight], [equal, minimum, *corners])

    def serialize(w):
        ret, vol, sharpe = stats(w)
        return {
            "weights": [float(x * 100) for x in w],
            "annualized_return": ret,
            "annualized_volatility": vol,
            "sharpe_ratio": sharpe,
        }

    # Efficient upper branch: minimum variance for returns >= the min-vol return.
    lower = float(minimum @ mu)
    # Maximum feasible expected return under the same allocation cap.
    best_return = np.zeros(n)
    remaining = 1.0
    for j in np.argsort(-mu):
        amount = min(limit, remaining)
        best_return[j] = amount
        remaining -= amount
        if remaining <= 1e-12:
            break
    upper = float(best_return @ mu)
    frontier = []
    previous = minimum
    for target in np.linspace(lower, upper, 24):
        constraints = [
            total_weight,
            {"type": "eq", "fun": lambda w, t=target: float(w @ mu - t)},
        ]
        try:
            w = solve(variance, constraints, [previous, equal, best_return])
        except ValueError:
            continue
        previous = w
        frontier.append({
            "annualized_return": float(w @ mu),
            "annualized_volatility": stats(w)[1],
        })

    return {
        "tickers": list(returns.columns),
        "max_weight_pct": None if max_weight is None else max_weight * 100,
        "minimum_volatility": serialize(minimum),
        "maximum_sharpe": serialize(maximum),
        "efficient_frontier": frontier,
        "assumptions": (
            "Long-only, fully invested, sample arithmetic annualized expected returns "
            "and covariance; 252 trading days. Historical estimates, not forecasts. "
            + (f"Per-stock allocation capped at {max_weight * 100:g}%." if max_weight is not None else "No per-stock allocation cap.")
        ),
    }
