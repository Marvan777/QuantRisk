"""Deterministic unit tests for the QuantRisk mean-variance optimizer."""
import numpy as np
import pandas as pd
import pytest

from app.optimizer import optimize_portfolio


def sample_prices(days=160):
    """Deterministic, positive prices with nonidentical return patterns."""
    t = np.arange(days, dtype=float)
    daily = np.column_stack([
        0.0006 + 0.004 * np.sin(t * 0.29),
        0.0003 + 0.006 * np.cos(t * 0.17),
        0.0008 + 0.008 * np.sin(t * 0.13 + 0.7),
    ])
    prices = 100 * np.vstack([np.ones(3), np.cumprod(1 + daily[1:], axis=0)])
    return pd.DataFrame(prices, index=pd.bdate_range('2024-01-02', periods=days),
                        columns=['AAA.NS', 'BBB.NS', 'CCC.NS'])


@pytest.fixture(scope='module')
def result():
    return optimize_portfolio(sample_prices(), risk_free_rate=0.02)


def test_allocations_are_long_only_and_sum_to_100(result):
    for key in ('minimum_volatility', 'maximum_sharpe'):
        weights = np.array(result[key]['weights'])
        assert len(weights) == 3
        assert np.all(weights >= -1e-6)
        assert np.all(weights <= 100 + 1e-6)
        assert weights.sum() == pytest.approx(100, abs=1e-4)


def test_minimum_variance_no_worse_than_equal_weight(result):
    returns = sample_prices().pct_change(fill_method=None).dropna()
    cov = returns.cov().to_numpy() * 252
    optimized = np.array(result['minimum_volatility']['weights']) / 100
    equal = np.ones(3) / 3
    assert optimized @ cov @ optimized <= equal @ cov @ equal + 1e-8
    assert result['minimum_volatility']['annualized_volatility'] == pytest.approx(
        np.sqrt(optimized @ cov @ optimized), rel=1e-6)


def test_maximum_sharpe_not_worse_than_candidate_allocations(result):
    returns = sample_prices().pct_change(fill_method=None).dropna()
    mu = returns.mean().to_numpy() * 252
    cov = returns.cov().to_numpy() * 252
    def sharpe(w):
        return (w @ mu - 0.02) / np.sqrt(w @ cov @ w)
    candidates = [np.ones(3)/3, *np.eye(3), np.array(result['minimum_volatility']['weights'])/100]
    reported = result['maximum_sharpe']['sharpe_ratio']
    assert reported == pytest.approx(sharpe(np.array(result['maximum_sharpe']['weights']) / 100), abs=1e-6)
    assert reported >= max(map(sharpe, candidates)) - 1e-5


def test_frontier_has_feasible_risk_return_points(result):
    points = result['efficient_frontier']
    assert len(points) >= 2
    for point in points:
        assert np.isfinite(point['annualized_return'])
        assert np.isfinite(point['annualized_volatility'])
        assert point['annualized_volatility'] >= 0
    assert all(a['annualized_return'] <= b['annualized_return'] + 1e-5
               for a, b in zip(points, points[1:]))


def test_rejects_insufficient_history():
    with pytest.raises(ValueError, match='30'):
        optimize_portfolio(sample_prices(days=20))


def test_rejects_single_asset():
    with pytest.raises(ValueError, match='two assets'):
        optimize_portfolio(sample_prices()[['AAA.NS']])


def test_rejects_nonfinite_risk_free_rate():
    with pytest.raises(ValueError, match='finite'):
        optimize_portfolio(sample_prices(), risk_free_rate=float('nan'))
