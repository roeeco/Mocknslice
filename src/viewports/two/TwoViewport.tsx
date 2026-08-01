import type { FabricationPart } from '../../domain/fabrication';
import type { Point2D } from '../../domain/geometry';
import { copy } from '../../locales/en';
import { useProjectStore } from '../../state/useProjectStore';

function boundsForPart(part: FabricationPart) {
  const points = part.paths.flatMap((path) => path.points);
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
}

function pathData(points: Point2D[], closed: boolean): string {
  return `${points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')}${closed ? ' Z' : ''}`;
}

function PartPreview({
  part,
  selected,
  onSelect,
}: {
  part: FabricationPart;
  selected: boolean;
  onSelect: () => void;
}) {
  const bounds = boundsForPart(part);
  const padding = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 0.08 + 1;
  const viewBox = `${bounds.minX - padding} ${bounds.minY - padding} ${bounds.maxX - bounds.minX + padding * 2} ${bounds.maxY - bounds.minY + padding * 2}`;
  return (
    <button
      type="button"
      className={`part-preview-card${selected ? ' is-selected' : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <svg viewBox={viewBox} role="img" aria-label={`${part.name} cut preview`}>
        <g fill="#f8f5ed" stroke="#d4472b" strokeWidth="0.35" vectorEffect="non-scaling-stroke">
          {part.paths.map((path) => (
            <path
              key={path.id}
              d={pathData(path.points, path.closed)}
              fill={path.contourRole === 'hole' ? '#dedbd2' : undefined}
              fillRule="evenodd"
            />
          ))}
        </g>
      </svg>
      <span>
        <strong>{part.label ?? part.name}</strong>
        <small>
          {part.slice ? `${part.slice.axis.toUpperCase()} ${part.slice.positionMm} mm` : part.name}
        </small>
      </span>
    </button>
  );
}

export function TwoViewport() {
  const sheet = useProjectStore((state) => state.project.sheetLayouts[0]);
  const parts = useProjectStore((state) => state.project.generatedParts);
  const selectedEntityId = useProjectStore((state) => state.selectedEntityId);
  const selectEntity = useProjectStore((state) => state.selectEntity);

  if (!sheet) return null;
  if (parts.length > 0) {
    return (
      <section className="viewport-stage two-stage parts-stage" aria-label={copy.layoutPreview}>
        <div className="parts-grid">
          {parts.map((part) => (
            <PartPreview
              key={part.id}
              part={part}
              selected={selectedEntityId === part.id}
              onSelect={() => selectEntity(part.id)}
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="viewport-stage two-stage" aria-label={copy.layoutPreview}>
      <svg
        className="sheet-preview"
        viewBox={`0 0 ${sheet.widthMm} ${sheet.heightMm}`}
        role="img"
        aria-label={`${sheet.widthMm} by ${sheet.heightMm} millimetre sheet`}
      >
        <rect
          x="0.5"
          y="0.5"
          width={sheet.widthMm - 1}
          height={sheet.heightMm - 1}
          fill="#fffdf8"
          stroke="#315c52"
        />
        <rect
          x={sheet.marginMm}
          y={sheet.marginMm}
          width={sheet.widthMm - sheet.marginMm * 2}
          height={sheet.heightMm - sheet.marginMm * 2}
          fill="none"
          stroke="#b4aea0"
          strokeDasharray="3 2"
        />
      </svg>
      <div className="empty-state">
        <span className="empty-state-mark" aria-hidden="true">
          ⌁
        </span>
        <h2>{copy.noPartsTitle}</h2>
        <p>{copy.noPartsBody}</p>
      </div>
    </section>
  );
}
