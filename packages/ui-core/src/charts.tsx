export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const startX = cx + r * Math.cos(start);
  const startY = cy + r * Math.sin(start);
  const endX = cx + r * Math.cos(end);
  const endY = cy + r * Math.sin(end);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${startX} ${startY} A ${r} ${r} 0 ${large} 1 ${endX} ${endY} Z`;
}

/**
 * Dependency-free allocation donut. Values may be any positive number.
 * @param slices labelled values and colors
 * @param size outer pixel size
 * @returns accessible SVG donut
 */
export function PieChart({ slices, size = 220 }: { slices: PieSlice[]; size?: number }) {
  const positive = slices.filter((slice) => slice.value > 0);
  const total = positive.reduce((sum, slice) => sum + slice.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 4;
  let cursor = -Math.PI / 2;
  const paths = positive.map((slice) => {
    const angle = total > 0 ? (slice.value / total) * Math.PI * 2 : 0;
    const path = arcPath(cx, cy, radius, cursor, cursor + angle);
    cursor += angle;
    return { ...slice, path, pct: total > 0 ? (slice.value / total) * 100 : 0 };
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Asset allocation">
        {paths.length === 0 ? <circle cx={cx} cy={cy} r={radius} fill="#e2e8f0" /> : null}
        {paths.map((slice) => (
          <path key={slice.label} d={slice.path} fill={slice.color}>
            <title>{`${slice.label}: ${slice.pct.toFixed(1)}%`}</title>
          </path>
        ))}
        <circle cx={cx} cy={cy} r={radius * 0.58} fill="white" />
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-slate-500 text-[11px]">
          Allocation
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-slate-900 text-sm font-semibold">
          {positive.length} classes
        </text>
      </svg>
      <ul className="space-y-2 text-sm">
        {paths.map((slice) => (
          <li key={slice.label} className="flex items-center gap-2 text-slate-700">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: slice.color }} />
            <span>{slice.label}</span>
            <span className="text-slate-500">{slice.pct.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface LinePoint {
  label: string;
  value: number;
}

/**
 * Dependency-free multi-series line chart with lightweight grid and labels.
 * @param series named point tracks
 * @param height chart height in pixels
 * @returns SVG chart
 */
export function LineChart({
  series,
  height = 260,
  formatValue = (value: number) => String(value),
}: {
  series: Array<{ name: string; color: string; points: LinePoint[] }>;
  height?: number;
  formatValue?: (value: number) => string;
}) {
  const width = 720;
  const padding = { top: 16, right: 16, bottom: 32, left: 56 };
  const all = series.flatMap((item) => item.points.map((point) => point.value));
  const max = Math.max(1, ...all);
  const min = Math.min(0, ...all);
  const range = max - min || 1;
  const labels = series[0]?.points.map((point) => point.label) ?? [];
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const xFor = (index: number, count: number) =>
    padding.left + (count <= 1 ? plotWidth / 2 : (index / (count - 1)) * plotWidth);
  const yFor = (value: number) => padding.top + ((max - value) / range) * plotHeight;
  const every = Math.max(1, Math.ceil(labels.length / 6));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Time series">
      {[0, 0.5, 1].map((fraction) => {
        const y = padding.top + fraction * plotHeight;
        return (
          <g key={fraction}>
            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e2e8f0" />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px]">
              {formatValue(max - fraction * range)}
            </text>
          </g>
        );
      })}
      {series.map((item) => {
        const count = item.points.length;
        const path = item.points
          .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index, count)} ${yFor(point.value)}`)
          .join(' ');
        return (
          <g key={item.name}>
            <path d={path} fill="none" stroke={item.color} strokeWidth={2.5} strokeLinejoin="round" />
            {item.points.map((point, index) => (
              <circle key={`${item.name}-${point.label}`} cx={xFor(index, count)} cy={yFor(point.value)} r={2.5} fill={item.color}>
                <title>{`${item.name} ${point.label}: ${formatValue(point.value)}`}</title>
              </circle>
            ))}
          </g>
        );
      })}
      {labels.map((label, index) =>
        index % every === 0 ? (
          <text
            key={label}
            x={xFor(index, labels.length)}
            y={height - 10}
            textAnchor="middle"
            className="fill-slate-400 text-[10px]"
          >
            {label.slice(0, 7)}
          </text>
        ) : null,
      )}
      {series.map((item, index) => (
        <g key={`legend-${item.name}`} transform={`translate(${padding.left + index * 130}, ${height - 24})`}>
          <rect width={8} height={8} y={-7} fill={item.color} rx={1} />
          <text x={14} y={1} className="fill-slate-600 text-[10px]">
            {item.name}
          </text>
        </g>
      ))}
    </svg>
  );
}
