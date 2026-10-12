import { Activity, ArrowDownRight, ArrowUpRight, Gauge, ShieldAlert, TrendingUp } from "lucide-react";
import { formatNumber, formatPct } from "../format.js";

const METRICS = [
  { key: "annualized_return", label: "Annual return", hint: "Geometric · 252 trading days", format: formatPct, signed: true, icon: TrendingUp },
  { key: "annualized_volatility", label: "Volatility", hint: "Annualized standard deviation", format: formatPct, icon: Activity },
  { key: "sharpe_ratio", label: "Sharpe ratio", hint: "Relative to selected risk-free rate", format: (v) => formatNumber(v, 2), signed: true, icon: Gauge },
  { key: "max_drawdown", label: "Max drawdown", hint: "Largest peak-to-trough decline", format: formatPct, signed: true, icon: ArrowDownRight },
  { key: "var_95_1d", label: "1-day 95% VaR", hint: "Historical downside threshold", format: formatPct, icon: ShieldAlert },
];

export default function MetricCards({ metrics, loading }) {
  return (
    <section aria-label="Portfolio risk metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {METRICS.map(({ key, label, hint, format, signed, icon: Icon }) => {
        const value = metrics?.[key];
        const valid = typeof value === "number" && Number.isFinite(value);
        const isNegative = signed && valid && value < 0;
        const isPositive = signed && valid && value > 0;
        const tone = isNegative ? "text-[#B85F50]" : isPositive ? "text-[#216B55]" : "text-[#1B2926]";
        return (
          <article key={key} className="group min-w-0 rounded-2xl border border-[#E5E1D8] bg-white px-4 py-4 shadow-[0_3px_14px_rgba(27,41,38,0.035)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#CBD7CE] hover:shadow-[0_10px_24px_rgba(27,41,38,0.07)]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#748078]">{label}</p>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#F2F5EF] text-[#216B55]"><Icon size={16} strokeWidth={1.8} /></span>
            </div>
            <div className="mt-3 flex min-h-[38px] items-center gap-1.5">
              {loading ? (
                <div className="h-7 w-24 animate-pulse rounded-md bg-[#EEECE6]" />
              ) : (
                <>
                  <p className={`font-mono text-[clamp(1.35rem,1.6vw,1.75rem)] font-semibold tracking-tight tabular-nums ${tone}`}>{valid ? format(value) : "—"}</p>
                  {isPositive && <ArrowUpRight size={15} className="text-[#216B55]" />}
                  {isNegative && <ArrowDownRight size={15} className="text-[#B85F50]" />}
                </>
              )}
            </div>
            <p className="mt-2 text-[11px] leading-snug text-[#818780]">{hint}</p>
          </article>
        );
      })}
    </section>
  );
}
