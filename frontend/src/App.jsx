import { useEffect, useMemo, useState } from "react";
import { AlertCircle, LineChart } from "lucide-react";
import { analyzePortfolio, optimizePortfolio, downloadReport} from "./api.js";
import MetricCards from "./components/MetricCards.jsx";
import { AllocationChart, CumulativeChart, DrawdownChart } from "./components/Charts.jsx";
import PortfolioForm from "./components/PortfolioForm.jsx";
import OptimizationPanel from "./components/OptimizationPanel.jsx";
import { formatDate } from "./format.js";

const DEFAULT_TICKERS = ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS"];

function equalWeights(n) {
  const w = 100 / n;
  return Array.from({ length: n }, () => w);
}

export default function App() {
  const [tickers, setTickers] = useState(DEFAULT_TICKERS);
  const [weights, setWeights] = useState(equalWeights(DEFAULT_TICKERS.length));
  const [period, setPeriod] = useState("2y");
  const [riskFreePct, setRiskFreePct] = useState(6.5);
  const [customTicker, setCustomTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [optimization, setOptimization] = useState(null);
  const [optimizing, setOptimizing] = useState(false);
  const [capEnabled, setCapEnabled] = useState(true);
  const [maxWeightPct, setMaxWeightPct] = useState(30);
  const [optimizationError, setOptimizationError] = useState("");
  const [exporting, setExporting] = useState(false);

   async function onExport() {
        if (!result) return;
        setExporting(true);
        setError('');
        try {
          await downloadReport({ analysis: result, optimization });
        } catch (err) {
          setError(err.message || 'PDF export failed.');
        } finally {
          setExporting(false);
        }
      }


  // Clear optimization results when any input changes to avoid stale comparisons.
  useEffect(() => {
    setOptimization(null);
    setOptimizationError("");
  }, [tickers, weights, period, riskFreePct, capEnabled, maxWeightPct]);

  async function onOptimize() {
    if (capEnabled && tickers.length * maxWeightPct < 100 - 1e-8) {
      setOptimizationError(`A ${maxWeightPct}% cap is not feasible for ${tickers.length} holdings. Increase it to at least ${(100 / tickers.length).toFixed(2)}%, add holdings, or disable the cap.`);
      return;
    }
    if (Math.abs(weightSum - 100) > 0.05) {
      setOptimizationError("Weights must sum to 100% before optimizing.");
      return;
    }
    setOptimizing(true);
    setOptimizationError("");
    try {
      const data = await optimizePortfolio({
        tickers: tickers.map((t) => t.trim().toUpperCase()),
        weights: weights.map(Number),
        period,
        risk_free_rate: Number(riskFreePct) / 100,
        max_weight_pct: capEnabled ? Number(maxWeightPct) : null,
      });
      setOptimization(data);
    } catch (err) {
      setOptimization(null);
      setOptimizationError(err.message || "Optimization failed.");
    } finally {
      setOptimizing(false);
    }
  }

  const weightSum = useMemo(
    () => weights.reduce((acc, w) => acc + Number(w || 0), 0),
    [weights]
  );

  function changeTicker(index, value) {
    const next = [...tickers];
    next[index] = value.toUpperCase();
    setTickers(next);
  }

  function changeWeight(index, value) {
    const next = [...weights];
    next[index] = Math.max(0, value);
    setWeights(next);
  }

  function normalizeWeights() {
    const clean = weights.map(w => Math.max(0, Number(w) || 0));
    const sum = clean.reduce((a, b) => a + b, 0);
    if (sum <= 0) { setWeights(equalWeights(tickers.length)); return; }
    const rounded = clean.map(w => Math.round((w / sum) * 10000) / 100);
    const correction = Math.round((100 - rounded.reduce((a,b) => a+b, 0)) * 100) / 100;
    rounded[rounded.length - 1] = Math.round((rounded[rounded.length - 1] + correction) * 100) / 100;
    setWeights(rounded);
  }

  function addTicker(explicit) {
    const raw = (typeof explicit === "string" ? explicit : customTicker).trim().toUpperCase();
    if (!raw) return;
    const symbol = raw.endsWith(".NS") ? raw : `${raw}.NS`;
    if (tickers.includes(symbol)) {
      setError("That ticker is already in the book.");
      return;
    }
    if (tickers.length >= 20) return;
    setTickers([...tickers, symbol]);
    setWeights(equalWeights(tickers.length + 1));
    setCustomTicker("");
    setError("");
  }

  function removeTicker(index) {
    if (tickers.length <= 2) return;
    const nextTickers = tickers.filter((_, i) => i !== index);
    setTickers(nextTickers);
    setWeights(equalWeights(nextTickers.length));
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (Math.abs(weightSum - 100) > 0.05) {
      setError("Weights must sum to 100% before running the analysis.");
      return;
    }
    if (tickers.length < 2 || tickers.length > 20) {
      setError("Select between 2 and 20 NSE tickers.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await analyzePortfolio({
        tickers: tickers.map((t) => t.trim().toUpperCase()),
        weights: weights.map((w) => Number(w)),
        period,
        risk_free_rate: Number(riskFreePct) / 100,
      });
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err.message || "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink-950 text-paper">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="lg:w-[340px] lg:shrink-0 lg:min-h-screen border-b lg:border-b-0 lg:border-r border-line bg-ink-900">
          <div className="px-6 py-5 border-b border-line flex items-center gap-3">
            <div className="h-9 w-9 border border-pine-600 flex items-center justify-center font-display text-pine-400">
              QR
            </div>
            <div>
              <p className="font-display text-xl leading-none">QuantRisk</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-mute">
                NSE portfolio desk
              </p>
            </div>
          </div>
          <div className="p-6">
            <PortfolioForm
              tickers={tickers}
              weights={weights}
              period={period}
              riskFreePct={riskFreePct}
              customTicker={customTicker}
              loading={loading}
              onChangeTicker={changeTicker}
              onChangeWeight={changeWeight}
              onAddTicker={addTicker}
              onRemoveTicker={removeTicker}
              onEqualWeights={() => setWeights(equalWeights(tickers.length))}
              onNormalizeWeights={normalizeWeights}
              onPeriod={setPeriod}
              onRiskFree={setRiskFreePct}
              onCustomTicker={setCustomTicker}
              onSubmit={onSubmit}
              weightSum={weightSum}
            />
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Risk report</p>
              <h1 className="mt-1 font-display text-2xl sm:text-3xl">Historical portfolio statistics</h1>
            </div>
            <div className="text-sm text-mute font-mono">
              {result ? (
                <span>
                  {formatDate(result.start_date)} — {formatDate(result.end_date)} · {result.observation_count} daily returns
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <LineChart size={14} /> Await first run
                </span>
              )}
            </div>
            <button type="button" onClick={onExport} disabled={!result || loading || exporting}
        className="border border-pine-600 bg-pine-600/20 px-4 py-2 text-sm text-paper hover:bg-pine-600/30 disabled:opacity-40">
        {exporting ? 'Generating PDF…' : 'Export PDF report'}
      </button>

          </header>

          {error ? (
            <div className="flex gap-3 border border-rust/40 bg-ink-850 px-4 py-3 text-sm text-paper">
              <AlertCircle size={16} className="mt-0.5 text-rust shrink-0" />
              <p>{error}</p>
            </div>
          ) : null}

          <MetricCards metrics={result?.metrics} loading={loading} />

          <div className="grid min-w-0 gap-4 xl:grid-cols-3">
            <div className="min-w-0 xl:col-span-2">
              <CumulativeChart series={result?.cumulative} loading={loading} />
            </div>
            <AllocationChart tickers={tickers} weights={weights} />
          </div>

          <DrawdownChart series={result?.drawdown} loading={loading} />

          <OptimizationPanel
            data={optimization}
            error={optimizationError}
            loading={optimizing}
            disabled={loading || optimizing}
            onOptimize={onOptimize}
            currentTickers={tickers}
            currentWeights={weights}
            capEnabled={capEnabled}
            maxWeightPct={maxWeightPct}
            onCapEnabled={setCapEnabled}
            onMaxWeightPct={setMaxWeightPct}
          />

          <section className="border border-line bg-ink-850 p-5">
            <h2 className="font-display text-lg">Assumptions</h2>
            <ul className="mt-3 grid gap-2 text-sm text-mute md:grid-cols-2">
              {(result?.assumptions || [
                "Adjusted closes from Yahoo Finance; daily simple returns; constant-weight daily rebalancing.",
                "Annualization uses 252 trading days. VaR is the historical 5th percentile, shown as a loss.",
              ]).map((line) => (
                <li key={line} className="border-l border-pine-600 pl-3">
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-mute leading-relaxed">
              {result?.disclaimer ||
                "Historical risk statistics are not predictions of future performance. This tool is for education and demonstration, not investment advice."}
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
