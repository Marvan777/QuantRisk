import { AlertCircle, ArrowUpRight, Target } from "lucide-react";
import {
  CartesianGrid, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";

const pct = (value) => Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : "—";
const number = (value) => Number.isFinite(value) ? value.toFixed(2) : "—";

function AllocationRows({ title, subtitle, portfolio, tickers }) {
  if (!portfolio) return null;
  return (
    <div className="rounded-xl border border-line bg-white p-4 space-y-3">
      <div>
        <h3 className="font-display text-lg text-paper">{title}</h3>
        <p className="text-xs text-mute mt-1">{subtitle}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 border-y border-line py-3">
        <div><p className="text-[10px] uppercase tracking-wider text-mute">Exp. return</p><p className="font-mono text-sm mt-1">{pct(portfolio.annualized_return)}</p></div>
        <div><p className="text-[10px] uppercase tracking-wider text-mute">Volatility</p><p className="font-mono text-sm mt-1">{pct(portfolio.annualized_volatility)}</p></div>
        <div><p className="text-[10px] uppercase tracking-wider text-mute">Sharpe</p><p className="font-mono text-sm mt-1">{number(portfolio.sharpe_ratio)}</p></div>
      </div>
      <div className="flex items-center justify-between text-xs text-mute"><span>Largest holding</span><span className="font-mono font-semibold text-paper">{Math.max(0, ...(portfolio.weights || [])).toFixed(1)}%</span></div>
      <div className="max-h-[360px] space-y-2 overflow-y-auto overscroll-contain pr-1">
        {tickers.map((ticker, index) => {
          const weight = portfolio.weights?.[index] ?? 0;
          return (
            <div key={ticker}>
              <div className="flex justify-between gap-2 text-xs mb-1"><span className="text-mute">{ticker}</span><span className="font-mono">{weight.toFixed(1)}%</span></div>
              <div className="h-1.5 rounded-full bg-ink-800 overflow-hidden"><div className="h-full rounded-full bg-pine-500" style={{ width: `${Math.min(100, Math.max(0, weight))}%` }} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FrontierTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-panel">
      <p>Expected return: <span className="font-mono">{pct(point.annualized_return)}</span></p>
      <p className="mt-1">Volatility: <span className="font-mono">{pct(point.annualized_volatility)}</span></p>
    </div>
  );
}

export default function OptimizationPanel({
  data, error, loading, disabled, onOptimize, currentTickers, currentWeights,
  capEnabled, maxWeightPct, onCapEnabled, onMaxWeightPct,
}) {
  const points = (data?.efficient_frontier || []).filter(
    (p) => Number.isFinite(p.annualized_return) && Number.isFinite(p.annualized_volatility)
  );
  const minPoint = data?.minimum_volatility ? [data.minimum_volatility] : [];
  const maxPoint = data?.maximum_sharpe ? [data.maximum_sharpe] : [];
  const tickers = data?.tickers || currentTickers;

  return (
    <section className="rounded-2xl border border-line bg-white p-5 sm:p-6 space-y-5 shadow-panel">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-pine-400">Mean–variance analysis</p>
          <h2 className="font-display text-xl mt-1">Portfolio optimization</h2>
          <p className="text-sm text-mute mt-1">Explore minimum-risk and maximum-Sharpe allocations.</p>
        </div>
        <button type="button" onClick={onOptimize} disabled={disabled || (capEnabled && (maxWeightPct < 1 || currentTickers.length * maxWeightPct < 100 - 1e-8))}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-pine-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-pine-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          <Target size={16} /> {loading ? "Optimizing…" : "Run optimization"} <ArrowUpRight size={14} />
        </button>
      </div>
      <div className="rounded-xl border border-line bg-[#F9F8F4] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Diversification limit</p>
            <p className="mt-1 text-xs text-mute">Apply the same per-stock cap to both optimized portfolios and the efficient frontier.</p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={capEnabled} onChange={(e) => onCapEnabled(e.target.checked)} className="accent-[#216B55]" />
            Enable cap
          </label>
        </div>
        {capEnabled && (
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="max-weight-cap" className="text-xs text-mute">Maximum weight per stock</label>
            <input id="max-weight-cap" type="number" min="1" max="100" step="1"
              value={String(maxWeightPct)} inputMode="numeric" onChange={(e) => {
                const cleaned = e.target.value.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "");
                onMaxWeightPct(cleaned === "" ? 0 : Math.min(100, Number(cleaned)));
              }}
              onBlur={() => { if (!Number.isFinite(maxWeightPct) || maxWeightPct < 1) onMaxWeightPct(1); }}
              className="w-20 rounded-lg border border-line bg-white px-2 py-1.5 text-sm font-mono outline-none focus:border-pine-500" />
            <span className="text-sm text-mute">%</span>
            {currentTickers.length * maxWeightPct < 100 - 1e-8 &&
              <p className="w-full text-xs text-rust">With {currentTickers.length} stocks, the cap must be at least {(100 / currentTickers.length).toFixed(2)}%.</p>}
          </div>
        )}
        {data && <p className="text-xs text-mute">Last optimization: {data.max_weight_pct == null ? "No allocation cap" : `${data.max_weight_pct}% maximum per stock`}</p>}
      </div>
      {error && <div className="flex items-start gap-2 border border-rust/40 p-3 text-sm"><AlertCircle size={16} className="text-rust shrink-0" />{error}</div>}
      {!data && !loading && !error && <p className="text-sm text-mute border-t border-line pt-4">Run optimization to view the efficient frontier and suggested allocations for the selected stocks.</p>}
      {data && (
        <>
          <div className="border-t border-line pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div><h3 className="font-display text-lg">Efficient frontier</h3><p className="text-xs text-mute mt-1">Annualized expected return vs. annualized volatility</p></div>
              <div className="flex flex-wrap gap-3 text-[11px] text-mute"><span className="text-pine-500">● Frontier</span><span className="text-[#2A9278]">● Min volatility</span><span className="text-[#CF795D]">● Max Sharpe</span></div>
            </div>
            {points.length === 0 ? (
              <p className="border border-line p-4 text-sm text-mute">No valid efficient-frontier points were returned. Check the optimizer response.</p>
            ) : (
            <div className="w-full min-w-0 rounded-xl bg-[#F9F8F4] p-2 sm:p-4" style={{ height: 360, minHeight: 360 }}>
              <ResponsiveContainer width="100%" height={330} debounce={50}>
                <ScatterChart margin={{ top: 18, right: 20, bottom: 24, left: 6 }}>
                  <CartesianGrid stroke="#E6E5DF" strokeDasharray="4 5" vertical={false} />
                  <XAxis type="number" dataKey="annualized_volatility" name="Volatility" domain={['auto', 'auto']} tickFormatter={pct} tick={{ fill: '#748078', fontSize: 11 }} label={{ value: 'Annualized volatility', position: 'insideBottom', offset: -10, fill: '#748078', fontSize: 11 }} />
                  <YAxis type="number" dataKey="annualized_return" name="Return" domain={['auto', 'auto']} tickFormatter={pct} tick={{ fill: '#748078', fontSize: 11 }} width={64} />
                  <ZAxis range={[42, 42]} />
                  <Tooltip content={<FrontierTooltip />} cursor={{ stroke: "#A5BEB4", strokeDasharray: "4 4" }} />
                  <Scatter name="Efficient frontier" data={points} fill="#216B55" line={{ stroke: "#216B55", strokeWidth: 3 }} lineType="joint" />
                  <Scatter name="Minimum volatility" data={minPoint} fill="#2A9278" shape="circle" />
                  <Scatter name="Maximum Sharpe" data={maxPoint} fill="#CF795D" shape="circle" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            )}
          </div>
          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <AllocationRows title="Minimum volatility" subtitle="Lowest historical variance under selected allocation constraints" portfolio={data.minimum_volatility} tickers={tickers} />
            <AllocationRows title="Maximum Sharpe" subtitle="Highest estimated excess return per unit of risk" portfolio={data.maximum_sharpe} tickers={tickers} />
          </div>
          <div className="border-t border-line pt-4">
            <h3 className="text-sm font-medium">Your selected allocation</h3>
            <p className="text-xs text-mute mt-2 font-mono break-words">{currentTickers.map((t, i) => `${t}: ${Number(currentWeights[i]).toFixed(1)}%`).join('  ·  ')}</p>
            <p className="text-xs text-mute mt-3">Optimizer return estimates use arithmetic daily means; the main dashboard displays geometric annualized returns. These figures are not directly comparable. {data.assumptions}</p>
          </div>
        </>
      )}
    </section>
  );
}
