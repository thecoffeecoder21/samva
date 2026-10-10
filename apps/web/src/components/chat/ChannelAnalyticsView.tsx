"use client";

import * as React from "react";
import { Table2, TrendingUp } from "lucide-react";
import { IconButton } from "@samva/ui";

interface AnalyticsData {
  totalFollowers: number;
  newFollowersLast30Days: number;
  messagesLast30Days: number;
  followerGrowth: { date: string; newFollowers: number; cumulativeFollowers: number }[];
  messageActivity: { date: string; count: number }[];
}

const CHART_WIDTH = 320;
const CHART_HEIGHT = 96;

export function ChannelAnalyticsView({ conversationId }: { conversationId: string }) {
  const [data, setData] = React.useState<AnalyticsData | null>(null);
  const [tableView, setTableView] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/channels/${conversationId}/analytics`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setData(json);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  if (!data) return <p className="py-4 text-center text-sm text-(--color-text-tertiary)">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <Stat label="Followers" value={data.totalFollowers} />
          <Stat label="New (30d)" value={data.newFollowersLast30Days} />
          <Stat label="Messages (30d)" value={data.messagesLast30Days} />
        </div>
        <IconButton
          aria-label={tableView ? "Show charts" : "Show as table"}
          size="sm"
          onClick={() => setTableView((v) => !v)}
        >
          {tableView ? <TrendingUp size={16} /> : <Table2 size={16} />}
        </IconButton>
      </div>

      {tableView ? (
        <AnalyticsTable data={data} />
      ) : (
        <>
          <LineChart
            title="Follower growth (30 days)"
            points={data.followerGrowth.map((d) => ({ date: d.date, value: d.cumulativeFollowers }))}
          />
          <BarChart title="Messages sent (30 days)" points={data.messageActivity.map((d) => ({ date: d.date, value: d.count }))} />
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-lg font-semibold text-(--color-text-primary)">{value}</p>
      <p className="text-[11px] text-(--color-text-tertiary)">{label}</p>
    </div>
  );
}

function AnalyticsTable({ data }: { data: AnalyticsData }) {
  return (
    <div className="max-h-64 overflow-y-auto rounded-(--radius-md) border border-(--color-border)">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-(--color-surface-raised) text-(--color-text-secondary)">
          <tr>
            <th className="px-2 py-1.5 text-left font-medium">Date</th>
            <th className="px-2 py-1.5 text-right font-medium">Followers</th>
            <th className="px-2 py-1.5 text-right font-medium">Messages</th>
          </tr>
        </thead>
        <tbody>
          {data.followerGrowth.map((row, i) => (
            <tr key={row.date} className="border-t border-(--color-border)">
              <td className="px-2 py-1.5 text-(--color-text-primary)">{row.date}</td>
              <td className="px-2 py-1.5 text-right text-(--color-text-secondary)">{row.cumulativeFollowers}</td>
              <td className="px-2 py-1.5 text-right text-(--color-text-secondary)">{data.messageActivity[i]?.count ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A single-series sequential line — one hue (the app's primary token), thin
 * 2px stroke with rounded caps, recessive gridlines, hover tooltip. No legend
 * needed for a single series; the title above names it. */
function LineChart({ title, points }: { title: string; points: { date: string; value: number }[] }) {
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => p.value));
  const stepX = CHART_WIDTH / Math.max(1, points.length - 1);
  const coords = points.map((p, i) => ({ x: i * stepX, y: CHART_HEIGHT - (p.value / max) * (CHART_HEIGHT - 8) - 4 }));
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const areaPath = `${path} L${CHART_WIDTH},${CHART_HEIGHT} L0,${CHART_HEIGHT} Z`;
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-(--color-text-secondary)">{title}</p>
      <div className="relative">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full"
          onMouseLeave={() => setHoverIndex(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            setHoverIndex(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))));
          }}
        >
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1={0}
              x2={CHART_WIDTH}
              y1={CHART_HEIGHT * f}
              y2={CHART_HEIGHT * f}
              stroke="var(--color-border)"
              strokeWidth={1}
            />
          ))}
          <path d={areaPath} fill="var(--color-primary)" opacity={0.08} stroke="none" />
          <path d={path} fill="none" stroke="var(--color-primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {hoverIndex !== null && (
            <>
              <line x1={coords[hoverIndex]!.x} x2={coords[hoverIndex]!.x} y1={0} y2={CHART_HEIGHT} stroke="var(--color-text-tertiary)" strokeWidth={1} strokeDasharray="2,2" />
              <circle cx={coords[hoverIndex]!.x} cy={coords[hoverIndex]!.y} r={4} fill="var(--color-primary)" />
            </>
          )}
        </svg>
        {hovered && (
          <div
            className="pointer-events-none absolute top-0 rounded-(--radius-sm) border border-(--color-border) bg-(--color-surface) px-1.5 py-1 text-[10px] shadow-(--shadow-sm)"
            style={{ left: `${Math.min(80, Math.max(0, (coords[hoverIndex!]!.x / CHART_WIDTH) * 100))}%` }}
          >
            <span className="font-medium text-(--color-text-primary)">{hovered.value}</span>{" "}
            <span className="text-(--color-text-tertiary)">{hovered.date.slice(5)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** A single-series bar chart, same hue as the line chart above, 2px surface
 * gaps between bars, rounded data-ends. */
function BarChart({ title, points }: { title: string; points: { date: string; value: number }[] }) {
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => p.value));
  const barWidth = CHART_WIDTH / points.length;
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-(--color-text-secondary)">{title}</p>
      <div className="relative">
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full" onMouseLeave={() => setHoverIndex(null)}>
          {points.map((p, i) => {
            const height = Math.max(2, (p.value / max) * (CHART_HEIGHT - 8));
            return (
              <rect
                key={p.date}
                x={i * barWidth + 1}
                y={CHART_HEIGHT - height}
                width={Math.max(1, barWidth - 2)}
                height={height}
                rx={2}
                fill="var(--color-primary)"
                opacity={hoverIndex === null || hoverIndex === i ? 0.85 : 0.35}
                onMouseEnter={() => setHoverIndex(i)}
              />
            );
          })}
        </svg>
        {hovered && (
          <div
            className="pointer-events-none absolute top-0 rounded-(--radius-sm) border border-(--color-border) bg-(--color-surface) px-1.5 py-1 text-[10px] shadow-(--shadow-sm)"
            style={{ left: `${Math.min(80, Math.max(0, (hoverIndex! / points.length) * 100))}%` }}
          >
            <span className="font-medium text-(--color-text-primary)">{hovered.value}</span>{" "}
            <span className="text-(--color-text-tertiary)">{hovered.date.slice(5)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
