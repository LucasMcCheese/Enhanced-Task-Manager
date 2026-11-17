import { useId, useState } from 'react';

interface AreaSparkChartProps {
  data: number[];
  color: string;
  height?: number;
  showGrid?: boolean;
  interactive?: boolean;
  unit?: string;
  label?: string;
}

/**
 * Generates a smooth Catmull-Rom-like cubic Bezier SVG path from points.
 */
function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

export function AreaSparkChart({
  data,
  color,
  height = 240,
  showGrid = true,
  interactive = true,
  unit = '%',
  label = 'Utilization',
}: AreaSparkChartProps) {
  const gradientId = useId().replace(/:/g, '');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 720;
  const padTop = showGrid ? 10 : 4;
  const padBottom = showGrid ? 10 : 4;
  const chartHeight = height - padTop - padBottom;

  const safeData = data.length > 1 ? data : [0, 0];
  const points = safeData.map((val, idx) => {
    const x = (idx / (safeData.length - 1)) * width;
    const clamped = Math.min(100, Math.max(0, val));
    const y = padTop + chartHeight - (clamped / 100) * chartHeight;
    return { x, y, val: clamped };
  });

  const linePath = buildSmoothPath(points);
  const areaPath = `${linePath} L ${width} ${padTop + chartHeight} L 0 ${padTop + chartHeight} Z`;

  const hoveredPoint = hoverIdx !== null ? points[hoverIdx] : null;
  const secondsAgo = hoverIdx !== null ? safeData.length - 1 - hoverIdx : 0;

  return (
    <div className="relative w-full select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full overflow-visible block"
        style={{ height }}
        role="img"
        aria-label={`${label} area chart, current value ${safeData[safeData.length - 1].toFixed(1)}${unit}`}
        onMouseLeave={() => setHoverIdx(null)}
        onMouseMove={(e) => {
          if (!interactive) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = (e.clientX - rect.left) / rect.width;
          const idx = Math.round(
            Math.min(safeData.length - 1, Math.max(0, relX * (safeData.length - 1))),
          );
          setHoverIdx(idx);
        }}
      >
        <defs>
          <linearGradient id={`area-grad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.34" />
            <stop offset="85%" stopColor={color} stopOpacity="0.06" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {showGrid && (
          <g stroke="rgba(255,255,255,0.06)" strokeWidth="1">
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
              const y = padTop + chartHeight * t;
              return <line key={`h-${t}`} x1="0" y1={y} x2={width} y2={y} />;
            })}
            {[0.166, 0.333, 0.5, 0.666, 0.833].map((t) => {
              const x = width * t;
              return (
                <line
                  key={`v-${t}`}
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={padTop + chartHeight}
                  strokeDasharray="3 4"
                />
              );
            })}
          </g>
        )}

        <path d={areaPath} fill={`url(#area-grad-${gradientId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={showGrid ? '2.2' : '1.75'}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {interactive && hoveredPoint && (
          <g>
            <line
              x1={hoveredPoint.x}
              y1={padTop}
              x2={hoveredPoint.x}
              y2={padTop + chartHeight}
              stroke="rgba(255,255,255,0.28)"
              strokeWidth="1"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={hoveredPoint.x}
              cy={hoveredPoint.y}
              r="4.5"
              fill="#141416"
              stroke={color}
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}
      </svg>

      {interactive && hoveredPoint && (
        <div
          className="pointer-events-none absolute top-2 px-2.5 py-1 rounded-md bg-[#202025]/95 border border-white/[0.12] text-xs font-mono text-zinc-100 shadow-lg tabular-nums whitespace-nowrap"
          style={{
            left: `clamp(8px, ${(hoverIdx! / (safeData.length - 1)) * 100}%, calc(100% - 110px))`,
            transform: 'translateX(-25%)',
          }}
        >
          <span>{hoveredPoint.val.toFixed(1)}{unit}</span>
          <span className="text-zinc-400 ml-1.5">
            {secondsAgo === 0 ? 'now' : `-${secondsAgo}s`}
          </span>
        </div>
      )}
    </div>
  );
}
