// Pure SVG price line for a market's implied probability over time.
// Each point is a probability in [0, 1]; 1 renders at the top.
export function Sparkline({
  points,
  width = 600,
  height = 72,
}: {
  points: number[];
  width?: number;
  height?: number;
}) {
  if (points.length < 2) {
    return <p className="muted small">No trades yet — the line starts moving once people bet.</p>;
  }

  const maxIndex = points.length - 1;
  const coords = points.map((p, i) => {
    const x = (i / maxIndex) * width;
    const y = height - Math.max(0, Math.min(1, p)) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const last = points[points.length - 1];
  const up = last >= points[0];

  return (
    <div className="spark-wrap">
      <svg
        className={`spark ${up ? "up" : "down"}`}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        width="100%"
        height={height}
        role="img"
        aria-label="Probability over time"
      >
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} className="spark-mid" />
        <polyline points={coords.join(" ")} className="spark-line" />
      </svg>
    </div>
  );
}
