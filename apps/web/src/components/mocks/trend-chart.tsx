import { formatDate } from '@/lib/format';
import type { MockTestSummary } from '@/lib/types';

/**
 * Score trend as an inline SVG. It is drawn straight from the recorded results
 * (percent of total marks), always on a 0 to 100 scale so a small change is not
 * made to look dramatic. A text alternative lists every point.
 */
export const TrendChart = ({ trend, timeZone }: { trend: MockTestSummary['trend']; timeZone: string }) => {
  if (trend.length === 0) return null;

  const width = 560;
  const height = 180;
  const pad = { left: 34, right: 12, top: 12, bottom: 22 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const x = (index: number) => pad.left + (trend.length === 1 ? innerW / 2 : (index / (trend.length - 1)) * innerW);
  const y = (percent: number) => pad.top + innerH - (Math.min(100, Math.max(0, percent)) / 100) * innerH;
  const points = trend.map((point, index) => `${x(index)},${y(point.percentage)}`).join(' ');
  const summary = trend.map((point) => `${point.name}: ${Math.round(point.percentage)}%`).join('; ');

  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={`Mock test scores over time. ${summary}`}>
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke="currentColor" strokeOpacity={0.12} />
            <text x={pad.left - 6} y={y(tick) + 3} textAnchor="end" fontSize={10} fill="currentColor" fillOpacity={0.6}>
              {tick}
            </text>
          </g>
        ))}
        {trend.length > 1 && <polyline points={points} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} strokeLinejoin="round" />}
        {trend.map((point, index) => (
          <g key={point.id}>
            <circle cx={x(index)} cy={y(point.percentage)} r={4} fill="hsl(var(--primary))">
              <title>{`${point.name}, ${formatDate(point.takenOn, timeZone)}: ${Math.round(point.percentage)}%`}</title>
            </circle>
          </g>
        ))}
      </svg>
      <figcaption className="text-xs text-muted-foreground">
        Score as a percentage of total marks, oldest to newest. Scale is fixed at 0 to 100.
      </figcaption>
      <ul className="sr-only">
        {trend.map((point) => (
          <li key={point.id}>{`${point.name}, ${formatDate(point.takenOn, timeZone)}: ${Math.round(point.percentage)} percent`}</li>
        ))}
      </ul>
    </figure>
  );
};
