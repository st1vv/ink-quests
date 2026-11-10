import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { formatNumber } from "@/lib/format";
import { shortDay, type Series } from "@/app/admin/chart-utils";

// Small hand-drawn SVG charts for the admin growth page. Text never wears
// the series colors; a swatch beside it carries the identity.
const HEIGHT = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 36 };
const GRID = "rgba(255,255,255,0.08)";
const AXIS_TEXT = "rgba(255,255,255,0.4)";
const SURFACE = "#131315";

// Width of the element, following resizes, so the SVG draws at 1:1 and its
// text stays crisp.
const useWidth = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry.contentRect.width)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
};

// Axis ticks from 0 to a round top at or above max, in 1, 2 or 5 × 10ⁿ
// steps; whole numbers only, as everything plotted is a count.
const niceTicks = (max: number, count = 4) => {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(
    1,
    [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? 10 * power,
  );
  const ticks = [0];
  while (ticks[ticks.length - 1] < max)
    ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
};

// About six evenly spaced day labels, the last day always among them.
const labelIndexes = (count: number) => {
  const every = Math.max(1, Math.ceil(count / 6));
  const out = new Set<number>();
  for (let i = count - 1; i >= 0; i -= every) out.add(i);
  return out;
};

export const Legend = ({ series }: { series: Series[] }) => (
  <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
    {series.map((s) => (
      <li key={s.label} className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="size-2.5 rounded-sm"
          style={{ backgroundColor: s.color }}
        />
        {s.label}
      </li>
    ))}
  </ul>
);

type DayChartProps = {
  days: string[];
  series: Series[];
  // Columns stacked bottom-up in series order, or one line per series.
  kind: "stacked-columns" | "lines";
  // Accessible name of the chart.
  label: string;
};

// A day-by-day chart with a hover/keyboard tooltip listing every series.
export const DayChart = ({ days, series, kind, label }: DayChartProps) => {
  const { ref, width } = useWidth();
  const [active, setActive] = useState<number | null>(null);

  const count = days.length;
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = count > 0 ? plotW / count : 0;
  const totals = days.map((_, i) =>
    kind === "stacked-columns"
      ? series.reduce((sum, s) => sum + s.values[i], 0)
      : Math.max(...series.map((s) => s.values[i])),
  );
  const ticks = niceTicks(Math.max(0, ...totals));
  const top = ticks[ticks.length - 1];
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const center = (i: number) => PAD.left + band * i + band / 2;
  const labels = labelIndexes(count);

  const pick = (e: PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - box.left) / band);
    setActive(Math.min(count - 1, Math.max(0, i)));
  };
  const step = (e: KeyboardEvent) => {
    const move = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (move === undefined || count === 0) return;
    e.preventDefault();
    setActive((i) => Math.min(count - 1, Math.max(0, (i ?? count) + move)));
  };

  const barW = Math.max(1, Math.min(24, band * 0.7 - 2));
  const tooltipLeft =
    active === null ? 0 : Math.min(Math.max(center(active), 70), width - 70);

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={label}
          tabIndex={0}
          onKeyDown={step}
          onBlur={() => setActive(null)}
          className="block rounded-xl focus-visible:outline-2 focus-visible:outline-ink-light"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke={GRID}
              />
              <text
                x={PAD.left - 8}
                y={y(t)}
                dy="0.32em"
                textAnchor="end"
                fontSize={11}
                fill={AXIS_TEXT}
                className="tabular-nums"
              >
                {formatNumber(t)}
              </text>
            </g>
          ))}

          {days.map(
            (day, i) =>
              labels.has(i) && (
                <text
                  key={day}
                  x={center(i)}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  fontSize={11}
                  fill={AXIS_TEXT}
                >
                  {shortDay(day)}
                </text>
              ),
          )}

          {active !== null && kind === "lines" && (
            <line
              x1={center(active)}
              x2={center(active)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="rgba(255,255,255,0.25)"
            />
          )}

          {kind === "stacked-columns"
            ? days.map((day, i) => (
                <Stack
                  key={day}
                  x={center(i) - barW / 2}
                  width={barW}
                  values={series.map((s) => s.values[i])}
                  colors={series.map((s) => s.color)}
                  y={y}
                  dim={active !== null && active !== i}
                />
              ))
            : series.map((s) => (
                <Line
                  key={s.label}
                  points={s.values.map((v, i) => [center(i), y(v)])}
                  color={s.color}
                  active={active}
                />
              ))}

          <rect
            x={PAD.left}
            y={PAD.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
      )}

      {active !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-max -translate-x-1/2 rounded-xl border border-white/10 bg-[#1c1c20] px-3 py-2 text-xs shadow-xl shadow-black/40"
          style={{ left: tooltipLeft }}
        >
          <p className="mb-1 font-medium text-white">
            {shortDay(days[active])}
          </p>
          {series.map((s) => (
            <p key={s.label} className="flex items-center gap-2 text-white/60">
              <span
                aria-hidden
                className="size-2 rounded-sm"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
              <span className="ml-auto pl-3 font-medium text-white tabular-nums">
                {formatNumber(s.values[active])}
              </span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

type StackProps = {
  x: number;
  width: number;
  values: number[];
  colors: string[];
  y: (v: number) => number;
  dim: boolean;
};

// One stacked column: square at the baseline, 4px round on top, a 2px
// surface gap between segments.
const Stack = ({ x, width, values, colors, y, dim }: StackProps) => {
  const topIndex = values.findLastIndex((v) => v > 0);
  // Where each segment starts: the sum of the ones below it.
  const bases = values.map((_, i) =>
    values.slice(0, i).reduce((sum, v) => sum + v, 0),
  );
  return (
    <g opacity={dim ? 0.45 : 1}>
      {values.map((v, i) => {
        if (v <= 0) return null;
        const y0 = y(bases[i]);
        const y1 = y(bases[i] + v);
        // The gap comes off the segment below the next one.
        const h = Math.max(0, y0 - y1 - (i < topIndex ? 2 : 0));
        const top = i < topIndex ? y1 + 2 : y1;
        const r = i === topIndex ? Math.min(4, h, width / 2) : 0;
        return (
          <path
            key={i}
            fill={colors[i]}
            d={`M${x},${top + h}V${top + r}Q${x},${top} ${x + r},${top}H${
              x + width - r
            }Q${x + width},${top} ${x + width},${top + r}V${top + h}Z`}
          />
        );
      })}
    </g>
  );
};

type LineProps = {
  points: [number, number][];
  color: string;
  active: number | null;
};

// A 2px line with a dot on its last point and on the hovered day.
const Line = ({ points, color, active }: LineProps) => {
  if (points.length === 0) return null;
  const last = points[points.length - 1];
  const dots = active === null ? [last] : [points[active]];
  return (
    <g>
      <polyline
        points={points.map((p) => p.join(",")).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {dots.map(([cx, cy]) => (
        <circle
          key={`${cx}`}
          cx={cx}
          cy={cy}
          r={4}
          fill={color}
          stroke={SURFACE}
          strokeWidth={2}
        />
      ))}
    </g>
  );
};
