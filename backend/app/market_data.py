from typing import List

import pandas as pd
import yfinance as yf


class MarketDataError(Exception):
    """Raised when historical prices cannot be retrieved or aligned."""


def fetch_adjusted_prices(tickers: List[str], period: str) -> pd.DataFrame:
    """Download adjusted daily closes and align histories on common dates.

    Uses yfinance auto_adjust=True so Close already reflects splits and dividends.
    """
    try:
        raw = yf.download(
            tickers=tickers,
            period=period,
            interval="1d",
            auto_adjust=True,
            group_by="column",
            progress=False,
            threads=True,
            timeout=30,
        )
    except Exception as exc:  # noqa: BLE001 — surface vendor errors as domain errors
        raise MarketDataError(
            "Unable to download market data. Check ticker symbols and network access."
        ) from exc

    if raw is None or raw.empty:
        raise MarketDataError(
            "No price history returned. Try a shorter period or different NSE tickers."
        )

    close = _extract_close(raw, tickers)
    close = close.sort_index()
    close = close.dropna(how="all")

    missing_tickers = [t for t in tickers if t not in close.columns]
    if missing_tickers:
        raise MarketDataError(
            "No adjusted close series for: " + ", ".join(missing_tickers)
        )

    aligned = close[tickers].dropna(how="any")
    if aligned.empty or len(aligned) < 30:
        raise MarketDataError(
            "Insufficient overlapping history after aligning dates "
            f"({len(aligned)} observations). Choose stocks with a shared listing period."
        )

    if (aligned <= 0).any().any():
        raise MarketDataError("Price series contains non-positive values and cannot be used.")

    idx = pd.to_datetime(aligned.index)
    if getattr(idx, "tz", None) is not None:
        aligned.index = idx.tz_convert("UTC").tz_localize(None)
    else:
        aligned.index = idx
    return aligned


def _extract_close(raw: pd.DataFrame, tickers: List[str]) -> pd.DataFrame:
    if isinstance(raw.columns, pd.MultiIndex):
        level0 = raw.columns.get_level_values(0)
        if "Close" in level0:
            close = raw["Close"].copy()
        else:
            close = raw.xs("Close", axis=1, level=1, drop_level=True).copy()
    else:
        if "Close" not in raw.columns:
            raise MarketDataError("Downloaded data does not include a Close column.")
        close = raw[["Close"]].copy()
        close.columns = [tickers[0]]

    close.columns = [str(c).upper() for c in close.columns]
    return close
