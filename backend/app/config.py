from typing import List

TRADING_DAYS_PER_YEAR = 252
VAR_CONFIDENCE = 0.95
MIN_HOLDINGS = 2
MAX_HOLDINGS = 20
WEIGHT_SUM_TOLERANCE = 1e-6
DEFAULT_PERIOD = "2y"
ALLOWED_PERIODS = ("6mo", "1y", "2y", "5y", "10y", "max")
DEFAULT_TICKERS = ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS"]
CORS_ORIGINS: List[str] = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
