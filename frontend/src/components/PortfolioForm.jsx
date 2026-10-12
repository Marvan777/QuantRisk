import { Plus, Trash2, Search, RotateCcw } from "lucide-react";
import { SUGGESTED_TICKERS } from "../format.js";

const MAX_HOLDINGS = 20;
const PERIODS = [
  { id: "6mo", label: "6M" }, { id: "1y", label: "1Y" },
  { id: "2y", label: "2Y" }, { id: "5y", label: "5Y" },
  { id: "10y", label: "10Y" }, { id: "max", label: "Max" },
];

export default function PortfolioForm({
  tickers, weights, period, riskFreePct, customTicker, loading,
  onChangeTicker, onChangeWeight, onAddTicker, onRemoveTicker,
  onEqualWeights, onNormalizeWeights, onPeriod, onRiskFree,
  onCustomTicker, onSubmit, weightSum,
}) {
  const canAdd = tickers.length < MAX_HOLDINGS;
  const canRemove = tickers.length > 2;
  const sumOk = Math.abs(weightSum - 100) < 0.05;
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-sm font-semibold text-paper">Portfolio holdings</h2>
          <p className="mt-1 text-xs text-mute">Set target allocation for each asset</p></div>
        <span className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-medium text-mute">{tickers.length} / {MAX_HOLDINGS}</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="grid grid-cols-[minmax(0,1fr)_78px_24px] gap-2 border-b border-line bg-[#F8F6F1] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-mute">
          <span>Asset</span><span className="text-right">Weight %</span><span />
        </div>
        <div className="divide-y divide-line overflow-y-auto overscroll-contain" style={{ maxHeight: 380, overflowY: "auto" }} role="region" aria-label="Portfolio holdings list" tabIndex={0}>
          {tickers.map((ticker, i) => (
            <div key={i} className="px-3 py-2 hover:bg-[#FAF9F6] transition-colors">
              <div className="grid grid-cols-[minmax(0,1fr)_78px_24px] items-center gap-2">
                <input aria-label={`Ticker ${i+1}`} value={ticker} onChange={(e) => onChangeTicker(i, e.target.value)}
                  className="min-w-0 w-full bg-transparent text-[13px] font-medium text-paper outline-none focus:text-pine-600" />
                <input aria-label={`${ticker} weight percent`} type="number" min="0.01" max="100" step="0.01"
                  value={Number(Number(weights[i] || 0).toFixed(2))} onChange={(e) => onChangeWeight(i, Number(e.target.value))}
                  className="w-full rounded-md border border-line bg-[#FAF9F6] px-2 py-1.5 text-right font-mono text-xs text-paper outline-none focus:border-pine-500" />
                <button type="button" disabled={!canRemove} onClick={() => onRemoveTicker(i)} aria-label={`Remove ${ticker}`}
                  className="flex justify-center text-mute hover:text-rust disabled:opacity-30"><Trash2 size={14}/></button>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#E9E7DF]">
                <div className="h-full rounded-full bg-pine-500 transition-all" style={{width: `${Math.min(100, Math.max(0, Number(weights[i]) || 0))}%`}} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-white px-3 focus-within:border-pine-500">
          <Search size={15} className="shrink-0 text-mute" />
          <input value={customTicker} disabled={!canAdd} onChange={(e) => onCustomTicker(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (canAdd) onAddTicker(); } }}
            placeholder="Add NSE ticker" className="min-w-0 w-full bg-transparent py-2.5 text-sm outline-none" />
        </div>
        <button type="button" disabled={!canAdd} onClick={() => onAddTicker()} aria-label="Add ticker"
          className="rounded-lg bg-pine-600 px-3 text-white hover:bg-pine-500 disabled:opacity-40"><Plus size={18}/></button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTED_TICKERS.filter(t => !tickers.includes(t)).slice(0,4).map(t => (
          <button type="button" key={t} disabled={!canAdd} onClick={() => onAddTicker(t)}
            className="rounded-md border border-line bg-white px-2 py-1 text-[11px] text-mute hover:text-pine-600 disabled:opacity-40">+ {t.replace('.NS','')}</button>
        ))}
      </div>
      <div className="rounded-xl border border-line bg-white p-3 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-mute">Total allocation</span>
          <span className={`font-mono font-semibold ${sumOk ? "text-pine-600" : "text-rust"}`}>{weightSum.toFixed(2)}%</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onEqualWeights} className="rounded-lg border border-line px-2 py-2 text-xs font-medium hover:bg-ink-850">Equal weights</button>
          <button type="button" onClick={onNormalizeWeights} className="inline-flex items-center justify-center gap-1 rounded-lg border border-line px-2 py-2 text-xs font-medium hover:bg-ink-850"><RotateCcw size={12}/> Normalize to 100%</button>
        </div>
        {!sumOk && <p className="text-xs text-rust">Weights must total 100% before analysis.</p>}
      </div>
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-mute">Historical period</h2>
        <div className="grid grid-cols-3 gap-1.5">
          {PERIODS.map(item => <button type="button" key={item.id} onClick={() => onPeriod(item.id)}
            className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${period === item.id ? "border-pine-600 bg-pine-600 text-white" : "border-line bg-white text-mute hover:text-paper"}`}>{item.label}</button>)}
        </div>
      </div>
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wider text-mute">Annual risk-free rate</span>
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2">
          <input type="number" min="0" max="25" step="0.1" value={riskFreePct} onChange={e => onRiskFree(Number(e.target.value))}
            className="w-full bg-transparent text-sm outline-none"/><span className="text-sm text-mute">%</span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-mute">Used for Sharpe ratio; not fetched live.</p>
      </label>
      <button type="submit" disabled={loading || !sumOk}
        className="w-full rounded-xl bg-pine-600 py-3 text-sm font-semibold text-white hover:bg-pine-500 disabled:opacity-40">
        {loading ? "Fetching market data…" : "Analyze portfolio"}
      </button>
    </form>
  );
}
