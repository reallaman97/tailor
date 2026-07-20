type Series = { label: string; color: string; values: number[] };

function niceCeil(value: number): number {
  if (value <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

/** Small, dependency-free SVG line chart — just enough for a trend-over-time view. */
export function LineChart({ labels, series }: { labels: string[]; series: Series[] }) {
  const chartWidth = 640;
  const chartHeight = 220;
  const padding = { top: 10, right: 16, bottom: 24, left: 32 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const maxValue = Math.max(1, ...series.flatMap((s) => s.values));
  const yMax = niceCeil(maxValue);
  const xStep = labels.length > 1 ? innerWidth / (labels.length - 1) : 0;

  function pointsFor(values: number[]): string {
    return values
      .map((v, i) => {
        const x = padding.left + i * xStep;
        const y = padding.top + innerHeight - (v / yMax) * innerHeight;
        return `${x},${y}`;
      })
      .join(" ");
  }

  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => Math.round((yMax / yTickCount) * i));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        {series.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Application trend over time"
      >
        {yTicks.map((v) => {
          const y = padding.top + innerHeight - (v / yMax) * innerHeight;
          return (
            <g key={v}>
              <line
                x1={padding.left}
                y1={y}
                x2={chartWidth - padding.right}
                y2={y}
                className="stroke-border"
                strokeWidth={1}
              />
              <text
                x={padding.left - 6}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground"
                fontSize={9}
              >
                {v}
              </text>
            </g>
          );
        })}

        {labels.map((label, i) => (
          <text
            key={label}
            x={padding.left + i * xStep}
            y={chartHeight - 6}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize={9}
          >
            {label}
          </text>
        ))}

        {series.map((s) => (
          <polyline
            key={s.label}
            points={pointsFor(s.values)}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </div>
  );
}
