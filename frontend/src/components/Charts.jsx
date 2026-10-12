import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPct } from "../format.js";

const ALLOC_COLORS = ["#216B55", "#D6A46B", "#76A893", "#334C65", "#B9B0A1", "#8B5E83", "#4F8F9D", "#BA705C", "#7E8950", "#586FA6", "#C08F9B", "#427D75", "#B68D4A", "#786EAA", "#A66D45", "#6A9A4D", "#B55E72", "#4E8190", "#A58D73", "#8D709F"];

function ChartFrame({ title, subtitle, children }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 sm:p-6 min-h-[320px] flex flex-col shadow-panel">
      <header className="mb-4">
        <h2 className="font-display font-semibold tracking-tight text-lg text-paper">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs text-mute">{subtitle}</p> : null}
      </header>
      <div className="flex-1 min-h-[240px]">{children}</div>
    </section>
  );
}

function EmptyState({ label }) {
  return (
    <div className="h-full min-h-[240px] flex items-center justify-center text-sm text-mute rounded-xl border border-dashed border-line bg-ink-850">
      {label}
    </div>
  );
}

export function CumulativeChart({ series, loading }) {
  if (loading) return <ChartFrame title="Cumulative growth"><EmptyState label="Loading prices…" /></ChartFrame>;
  if (!series?.length) return <ChartFrame title="Cumulative growth"><EmptyState label="Run an analysis to plot wealth." /></ChartFrame>;

  return (
    <ChartFrame
      title="Cumulative growth"
      subtitle="Wealth index starting at 1.0 under daily constant-weight rebalancing."
    >
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#EAE7DF" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "#78817A", fontSize: 11 }} minTickGap={48} tickLine={false} axisLine={{ stroke: "#EAE7DF" }} />
          <YAxis tick={{ fill: "#78817A", fontSize: 11 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{ background: "#FFFFFF", border: "1px solid #E5E1D8", borderRadius: 12, color: "#1B2926", boxShadow: "0 12px 28px rgba(27,41,38,.08)", fontSize: 12 }}
            labelStyle={{ color: "#78817A" }}
            formatter={(value) => [Number(value).toFixed(3), "Wealth"]}
          />
          <Area type="monotone" dataKey="value" stroke="#216B55" fill="#CFE7DC" fillOpacity={0.7} strokeWidth={2.5} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function DrawdownChart({ series, loading }) {
  if (loading) return <ChartFrame title="Drawdown"><EmptyState label="Loading prices…" /></ChartFrame>;
  if (!series?.length) return <ChartFrame title="Drawdown"><EmptyState label="Run an analysis to plot drawdown." /></ChartFrame>;

  const data = series.map((p) => ({ ...p, value: p.value * 100 }));

  return (
    <ChartFrame title="Portfolio drawdown" subtitle="Percent decline from the running peak of the wealth index.">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#EAE7DF" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "#78817A", fontSize: 11 }} minTickGap={48} tickLine={false} axisLine={{ stroke: "#EAE7DF" }} />
          <YAxis tick={{ fill: "#78817A", fontSize: 11 }} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ background: "#FFFFFF", border: "1px solid #E5E1D8", borderRadius: 12, color: "#1B2926", boxShadow: "0 12px 28px rgba(27,41,38,.08)", fontSize: 12 }}
            formatter={(value) => [`${Number(value).toFixed(2)}%`, "Drawdown"]}
          />
          <Area type="monotone" dataKey="value" stroke="#B85F50" fill="#F1D9D2" fillOpacity={0.65} strokeWidth={2.5} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function AllocationChart({ tickers, weights }) {
  if (!tickers?.length) {
    return <ChartFrame title="Asset allocation"><EmptyState label="Add holdings to see weights." /></ChartFrame>;
  }

  const data = tickers.map((ticker, i) => ({
    name: ticker.replace(".NS", ""),
    value: Math.max(0, Number(weights[i]) || 0),
  }));
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = 76;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;
  const segments = data.map((item, i) => {
    const fraction = total > 0 ? item.value / total : 0;
    const segment = {
      ...item,
      color: ALLOC_COLORS[i % ALLOC_COLORS.length],
      length: fraction * circumference,
      offset: -cumulative * circumference,
    };
    cumulative += fraction;
    return segment;
  });

  return (
    <ChartFrame title="Asset allocation" subtitle="Target weights. The engine rebalances to these weights each trading day.">
      <div className="flex min-w-0 flex-col items-center gap-5 pt-2">
        <svg
          viewBox="0 0 220 220"
          width="220"
          height="220"
          className="block h-[220px] w-[220px] max-w-full shrink-0"
          role="img"
          aria-label={`Portfolio allocation: ${data.map((d) => `${d.name} ${d.value}%`).join(", ")}`}
        >
          <circle cx="110" cy="110" r={radius} fill="none" stroke="#F0EEE8" strokeWidth="29" />
          <g transform="rotate(-90 110 110)">
            {segments.map((segment) => (
              <circle
                key={segment.name}
                cx="110"
                cy="110"
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth="29"
                strokeDasharray={`${segment.length} ${circumference}`}
                strokeDashoffset={segment.offset}
                strokeLinecap="butt"
              />
            ))}
          </g>
          <text x="110" y="102" textAnchor="middle" fill="#78817A" fontSize="11" letterSpacing="1.5">HOLDINGS</text>
          <text x="110" y="137" textAnchor="middle" fill="#1B2926" fontSize="34" fontWeight="700">{data.length}</text>
        </svg>
        <ul className={`grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2 ${segments.length > 8 ? "max-h-[320px] overflow-y-auto overscroll-contain pr-1" : ""}`} aria-label="Asset allocation legend">
          {segments.map((row) => (
            <li key={row.name} className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-ink-850 px-3 py-2.5 text-xs">
              <span className="flex min-w-0 items-center gap-2 text-paper">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: row.color }} />
                <span className="truncate">{row.name}</span>
              </span>
              <span className="shrink-0 font-mono text-mute">{formatPct(row.value / 100, 1)}</span>
            </li>
          ))}
        </ul>
      </div>
    </ChartFrame>
  );
}
