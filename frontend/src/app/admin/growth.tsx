import { useSearchParams } from "react-router";
import { Surface } from "@/shared/ui/surface";
import { PageIntro } from "@/shared/ui/page-intro";
import { StatCard } from "@/shared/ui/stat-card";
import { TabButton } from "@/shared/ui/tab-button";
import { Skeleton } from "@/shared/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { useAuth } from "@/app/auth/use-auth";
import { NotFound } from "@/app/not-found/not-found";
import { AdminNav } from "@/app/admin/admin-nav";
import { DayChart, Legend } from "@/app/admin/charts";
import { SERIES_COLORS, shortDay, type Series } from "@/app/admin/chart-utils";
import {
  isNotFound,
  useGrowth,
  type Growth as GrowthData,
  type GrowthDay,
  type GrowthRange,
} from "@/app/admin/use-admin";

const RANGES: { value: GrowthRange; label: string }[] = [
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "all", label: "All time" },
];
const DEFAULT_RANGE: GrowthRange = "30";

const isRange = (value: string | null): value is GrowthRange =>
  RANGES.some((r) => r.value === value);

const percent = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";

// Growth charts: are new users coming, do they come back, how far they get.
// Hidden like the other admin pages until the backend confirms an admin.
export const Growth = () => {
  const { address, status } = useAuth();
  const [params, setParams] = useSearchParams();
  const raw = params.get("range");
  const range = isRange(raw) ? raw : DEFAULT_RANGE;
  const growth = useGrowth(range);

  if (status === "loading" || (address && growth.isPending)) return null;
  if (!address || isNotFound(growth.error)) return <NotFound />;

  const data = growth.data;
  const setRange = (next: GrowthRange) =>
    setParams(next === DEFAULT_RANGE ? {} : { range: next });

  return (
    <div className="flex flex-col gap-4">
      <AdminNav />
      <PageIntro
        eyebrow="Admin"
        title="Growth"
        description={
          growth.isError ? (
            <>
              Couldn't load the charts.{" "}
              <button
                type="button"
                onClick={() => growth.refetch()}
                className="cursor-pointer font-semibold text-ink-light hover:text-white"
              >
                Try again
              </button>
            </>
          ) : (
            "New users, who comes back and how far they get. Days and weeks are UTC; a user is active on a day they check in, complete a quest or finish a partner quest."
          )
        }
        aside={
          <div
            role="tablist"
            aria-label="Range"
            className="flex w-fit shrink-0 gap-1 rounded-full border border-white/10 bg-black/20 p-1"
          >
            {RANGES.map((r) => (
              <TabButton
                key={r.value}
                label={r.label}
                selected={range === r.value}
                onClick={() => setRange(r.value)}
              />
            ))}
          </div>
        }
      >
        <Headline data={data} />
      </PageIntro>

      {data ? (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <NewUsersChart days={data.days} />
            <ActiveUsersChart days={data.days} />
          </div>
          <Conversion totals={data.totals} />
          <Cohorts cohorts={data.cohorts} />
        </>
      ) : (
        <Skeleton className="h-80 rounded-[32px] border border-white/10 bg-white/5" />
      )}
    </div>
  );
};

const sum = (days: GrowthDay[], pick: (d: GrowthDay) => number) =>
  days.reduce((total, d) => total + pick(d), 0);

// "+3 vs previous 7 days"; nothing without a full previous week.
const versus = (now: number, before: number | null, digits = 0) => {
  if (before === null) return undefined;
  const diff = now - before;
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "±";
  return `${sign}${Math.abs(diff).toFixed(digits)} vs previous 7 days`;
};

// The last 7 days against the 7 before, plus where users come from.
const Headline = ({ data }: { data: GrowthData | undefined }) => {
  const days = data?.days ?? [];
  const last = days.slice(-7);
  const previous = days.length >= 14 ? days.slice(-14, -7) : null;
  const newUsers = sum(last, (d) => d.newUsers);
  const avgActive = last.length ? sum(last, (d) => d.active) / last.length : 0;
  const totals = data?.totals;

  const cards = [
    {
      label: "New users, last 7 days",
      value: formatNumber(newUsers),
      hint: versus(newUsers, previous && sum(previous, (d) => d.newUsers)),
    },
    {
      label: "Active per day, 7-day average",
      value: avgActive.toFixed(1),
      hint: versus(
        avgActive,
        previous && sum(previous, (d) => d.active) / 7,
        1,
      ),
    },
    {
      label: "Came by invite link",
      value: totals ? percent(totals.referred, totals.users) : "—",
      hint: totals && `${formatNumber(totals.referred)} of all users`,
    },
    {
      label: "Linked X",
      value: totals ? percent(totals.xLinked, totals.users) : "—",
      hint: totals && `${formatNumber(totals.xLinked)} of all users`,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <StatCard
          key={card.label}
          label={card.label}
          value={data ? card.value : "—"}
          hint={data ? card.hint : undefined}
        />
      ))}
    </div>
  );
};

type ChartCardProps = {
  title: string;
  description: string;
  series: Series[];
  days: GrowthDay[];
  kind: "stacked-columns" | "lines";
};

// A daily chart with its legend, and the same numbers as a table.
const ChartCard = ({
  title,
  description,
  series,
  days,
  kind,
}: ChartCardProps) => (
  <Surface className="flex flex-col gap-4">
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="text-sm text-white/50">{description}</p>
      <Legend series={series} />
    </div>
    <DayChart
      days={days.map((d) => d.day)}
      series={series}
      kind={kind}
      label={title}
    />
    <details className="text-sm">
      <summary className="cursor-pointer text-white/50 hover:text-white">
        Show as table
      </summary>
      <div className="mt-3 max-h-72 overflow-y-auto">
        <table className="w-full text-left tabular-nums">
          <thead className="sticky top-0 bg-[#141416] text-xs text-white/40">
            <tr>
              <th className="py-1.5 font-medium">Day</th>
              {series.map((s) => (
                <th key={s.label} className="py-1.5 text-right font-medium">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-white/80">
            {days
              .map((d, i) => ({ day: d.day, i }))
              .reverse()
              .map(({ day, i }) => (
                <tr key={day} className="border-t border-white/5">
                  <td className="py-1.5">{shortDay(day)}</td>
                  {series.map((s) => (
                    <td key={s.label} className="py-1.5 text-right">
                      {formatNumber(s.values[i])}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </details>
  </Surface>
);

const NewUsersChart = ({ days }: { days: GrowthDay[] }) => (
  <ChartCard
    title="New users per day"
    description={`${formatNumber(sum(days, (d) => d.newUsers))} in this range. Spikes show which posts, challenges and partner quests brought people in.`}
    kind="stacked-columns"
    days={days}
    series={[
      {
        label: "On their own",
        color: SERIES_COLORS[0],
        values: days.map((d) => d.newUsers - d.referred),
      },
      {
        label: "By invite link",
        color: SERIES_COLORS[1],
        values: days.map((d) => d.referred),
      },
    ]}
  />
);

const ActiveUsersChart = ({ days }: { days: GrowthDay[] }) => (
  <ChartCard
    title="Active users per day"
    description="Everyone who did something that day, and those of them who did it onchain."
    kind="lines"
    days={days}
    series={[
      {
        label: "Active",
        color: SERIES_COLORS[0],
        values: days.map((d) => d.active),
      },
      {
        label: "Onchain",
        color: SERIES_COLORS[1],
        values: days.map((d) => d.onchain),
      },
    ]}
  />
);

// All-time share of users who reached each step. Not a strict funnel: a
// user can transact onchain on their only day.
const Conversion = ({ totals }: { totals: GrowthData["totals"] }) => {
  const steps = [
    { label: "Signed up", value: totals.users },
    { label: "Earned XP", value: totals.withXp },
    { label: "Came back (active on 2+ days)", value: totals.returned },
    { label: "Did something onchain", value: totals.onchain },
    { label: "Regulars (active on 7+ days)", value: totals.regulars },
  ];

  return (
    <Surface className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-white">How far users get</h2>
        <p className="mt-2 text-sm text-white/50">
          All time, as a share of everyone who signed up.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {steps.map((step) => {
          const share = totals.users > 0 ? step.value / totals.users : 0;
          return (
            <li key={step.label} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-white/70">{step.label}</span>
                <span className="text-white tabular-nums">
                  {formatNumber(step.value)}
                  <span className="ml-2 text-white/40">
                    {percent(step.value, totals.users)}
                  </span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/5">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${share * 100}%`,
                    backgroundColor: SERIES_COLORS[0],
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Surface>
  );
};

// Week 2026-11-02 → Nov 2
const weekLabel = (week: string) => `Week of ${shortDay(week)}`;

// Signup cohorts by week: what share was active in each week after.
const Cohorts = ({ cohorts }: { cohorts: GrowthData["cohorts"] }) => {
  const weeks = Math.max(0, ...cohorts.map((c) => c.active.length));

  return (
    <Surface className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Weekly retention</h2>
        <p className="mt-2 text-sm text-white/50">
          Users grouped by the week they signed up, and the share of them active
          in each week since. Week 0 is the signup week itself; the darker the
          cell, the fewer came back.
        </p>
      </div>
      {cohorts.length === 0 ? (
        <p className="text-sm text-white/50">No users yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0.5 text-sm tabular-nums">
            <thead className="text-xs text-white/40">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Signed up</th>
                <th className="px-2 py-1.5 text-right font-medium">Users</th>
                {Array.from({ length: weeks }, (_, k) => (
                  <th key={k} className="px-2 py-1.5 font-medium">
                    W{k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => (
                <tr key={c.week}>
                  <td className="px-2 py-1.5 whitespace-nowrap text-white/70">
                    {weekLabel(c.week)}
                  </td>
                  <td className="px-2 py-1.5 text-right text-white/70">
                    {formatNumber(c.size)}
                  </td>
                  {Array.from({ length: weeks }, (_, k) => {
                    const active = c.active[k];
                    if (active === undefined) return <td key={k} />;
                    const share = c.size > 0 ? active / c.size : 0;
                    return (
                      <td
                        key={k}
                        title={`${formatNumber(active)} of ${formatNumber(c.size)} active`}
                        className="min-w-12 rounded-md px-2 py-1.5 text-center text-white"
                        style={{
                          backgroundColor: `rgba(57, 135, 229, ${0.06 + share * 0.8})`,
                        }}
                      >
                        {percent(active, c.size)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Surface>
  );
};
