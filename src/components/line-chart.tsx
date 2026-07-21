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

  /**
   * Smooth curve through the points using monotone cubic interpolation
   * (Fritsch–Carlson). Unlike a plain Catmull-Rom spline it never overshoots
   * the data, so a line can't bulge above or dip below its own points.
   */
  function pathFor(values: number[]): string {
    const pts = values.map((v, i) => ({
      x: padding.left + i * xStep,
      y: padding.top + innerHeight - (v / yMax) * innerHeight,
    }));
    const n = pts.length;
    if (n === 0) return "";
    if (n === 1) return `M ${pts[0].x},${pts[0].y}`;

    const dx = pts.map((p, i) => (i < n - 1 ? pts[i + 1].x - p.x : 0));
    const slope = pts.map((p, i) => (i < n - 1 ? (pts[i + 1].y - p.y) / dx[i] : 0));

    const m = new Array<number>(n).fill(0);
    m[0] = slope[0];
    m[n - 1] = slope[n - 2];
    for (let i = 1; i < n - 1; i++) {
      m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
    }
    // Clamp tangents to keep each segment monotone (no overshoot).
    for (let i = 0; i < n - 1; i++) {
      if (slope[i] === 0) {
        m[i] = 0;
        m[i + 1] = 0;
      } else {
        const a = m[i] / slope[i];
        const b = m[i + 1] / slope[i];
        const h = Math.hypot(a, b);
        if (h > 3) {
          const t = 3 / h;
          m[i] = t * a * slope[i];
          m[i + 1] = t * b * slope[i];
        }
      }
    }

    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < n - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const cp1x = p1.x + dx[i] / 3;
      const cp1y = p1.y + (m[i] * dx[i]) / 3;
      const cp2x = p2.x - dx[i] / 3;
      const cp2y = p2.y - (m[i + 1] * dx[i]) / 3;
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
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
          <path
            key={s.label}
            d={pathFor(s.values)}
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
