import numpy as np
import pandas as pd
import pytest
from scipy.stats import scoreatpercentile

from app.analytics import analyze_portfolio
from app.config import TRADING_DAYS_PER_YEAR


def _two_asset_prices() -> pd.DataFrame:
    """Synthetic adjusted closes with a known path."""
    dates = pd.bdate_range("2024-01-02", periods=6)
    return pd.DataFrame(
        {
            "AAA.NS": [100.0, 110.0, 105.0, 120.0, 118.0, 130.0],
            "BBB.NS": [100.0, 90.0, 95.0, 100.0, 92.0, 96.0],
        },
        index=dates,
    )


def test_daily_rebalanced_returns_match_weight_times_asset_returns():
    prices = _two_asset_prices()
    weights = [60.0, 40.0]
    result = analyze_portfolio(prices, weights, period="1y", risk_free_rate=0.05)

    asset_returns = prices.pct_change().dropna()
    expected_port = asset_returns.to_numpy() @ np.array([0.6, 0.4])
    wealth = np.cumprod(1.0 + expected_port)

    np.testing.assert_allclose(
        [p.value for p in result.cumulative],
        wealth,
        rtol=1e-12,
    )
    assert result.observation_count == 5
    assert result.trading_days_per_year == TRADING_DAYS_PER_YEAR


def test_geometric_annualized_return():
    prices = _two_asset_prices()
    result = analyze_portfolio(prices, [50.0, 50.0], "1y", 0.05)
    terminal = result.cumulative[-1].value
    expected = terminal ** (TRADING_DAYS_PER_YEAR / result.observation_count) - 1.0
    assert result.metrics.annualized_return == pytest.approx(expected, rel=1e-12)


def test_max_drawdown_is_negative_peak_to_trough():
    dates = pd.bdate_range("2024-01-02", periods=4)
    prices = pd.DataFrame(
        {
            "AAA.NS": [100.0, 120.0, 90.0, 99.0],
            "BBB.NS": [100.0, 120.0, 90.0, 99.0],
        },
        index=dates,
    )
    result = analyze_portfolio(prices, [50.0, 50.0], "1y", 0.0)
    # Identical assets: wealth 1 -> 1.2 -> 0.9 -> 0.99; max DD = 0.9/1.2 - 1 = -0.25
    assert result.metrics.max_drawdown == pytest.approx(-0.25, rel=1e-12)
    assert min(p.value for p in result.drawdown) == pytest.approx(-0.25, rel=1e-12)


def test_historical_var_is_negative_empirical_quantile_as_loss():
    dates = pd.bdate_range("2024-01-02", periods=6)
    # One asset so portfolio returns equal asset returns.
    prices = pd.DataFrame(
        {
            "AAA.NS": [100.0, 101.0, 102.0, 90.0, 91.0, 92.0],
            "BBB.NS": [100.0, 101.0, 102.0, 90.0, 91.0, 92.0],
        },
        index=dates,
    )
    result = analyze_portfolio(prices, [50.0, 50.0], "1y", 0.0)
    daily = prices["AAA.NS"].pct_change().dropna().to_numpy()
    expected_var = -float(scoreatpercentile(daily, 5.0))
    assert result.metrics.var_95_1d == pytest.approx(expected_var, rel=1e-12)
    assert result.metrics.var_95_1d > 0


def test_sharpe_uses_arithmetic_excess_return():
    prices = _two_asset_prices()
    rf = 0.06
    result = analyze_portfolio(prices, [70.0, 30.0], "1y", rf)
    asset_returns = prices.pct_change().dropna()
    port = asset_returns.to_numpy() @ np.array([0.7, 0.3])
    ann_arith = port.mean() * TRADING_DAYS_PER_YEAR
    ann_vol = port.std(ddof=1) * np.sqrt(TRADING_DAYS_PER_YEAR)
    expected = (ann_arith - rf) / ann_vol
    assert result.metrics.sharpe_ratio == pytest.approx(expected, rel=1e-12)
    assert result.metrics.annualized_volatility == pytest.approx(ann_vol, rel=1e-12)


def test_mismatched_weights_raise():
    prices = _two_asset_prices()
    with pytest.raises(ValueError):
        analyze_portfolio(prices, [100.0], "1y", 0.05)
