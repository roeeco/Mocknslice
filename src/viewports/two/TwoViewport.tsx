import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { FabricationPart, SheetPlacement } from '../../domain/fabrication';
import type { Point2D } from '../../domain/geometry';
import { transformPoint, transformedBoundsForPart } from '../../geometry/layout/partPlacement';
import { copy } from '../../locales/en';
import { useProjectStore } from '../../state/useProjectStore';

interface DragState {
  partId: string;
  pointerId: number;
  start: Point2D;
  originX: number;
  originY: number;
  x: number;
  y: number;
}

function decimal(value: number): string {
  return String(Math.round(value * 1_000_000) / 1_000_000);
}

function pathData(points: Point2D[], placement: SheetPlacement, closed: boolean): string {
  if (points.length === 0) return '';
  return `${points
    .map((point, index) => {
      const transformed = transformPoint(point, placement);
      return `${index === 0 ? 'M' : 'L'} ${decimal(transformed.x)} ${decimal(transformed.y)}`;
    })
    .join(' ')}${closed ? ' Z' : ''}`;
}

function screenPoint(svg: SVGSVGElement, clientX: number, clientY: number): Point2D | undefined {
  const matrix = svg.getScreenCTM();
  if (!matrix) return undefined;
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const transformed = point.matrixTransform(matrix.inverse());
  return { x: transformed.x, y: transformed.y };
}

function PartOnSheet({
  part,
  placement,
  selected,
  selectedEntityId,
  invalid,
  strokeByOperation,
  onPointerDown,
  onSelect,
  onSelectEntity,
}: {
  part: FabricationPart;
  placement: SheetPlacement;
  selected: boolean;
  selectedEntityId: string | undefined;
  invalid: boolean;
  strokeByOperation: Map<string, string>;
  onPointerDown: (event: PointerEvent<SVGGElement>) => void;
  onSelect: () => void;
  onSelectEntity: (id: string) => void;
}) {
  const bounds = transformedBoundsForPart(part, placement);
  const handleKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onSelect();
  };

  return (
    <g
      className={`sheet-part${selected ? ' is-selected' : ''}${invalid ? ' is-invalid' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${part.name} on sheet`}
      aria-pressed={selected}
      data-part-id={part.id}
      onPointerDown={onPointerDown}
      onKeyDown={handleKeyDown}
      onClick={onSelect}
    >
      {part.paths.map((path) => {
        const entityId = path.tabId ?? path.edgeId ?? path.panelId;
        const entitySelected = [path.tabId, path.edgeId, path.panelId].includes(selectedEntityId);
        return (
          <path
            key={path.id}
            d={pathData(path.points, placement, path.closed)}
            fill={
              path.contourRole === 'outer'
                ? '#f8f5ed'
                : path.contourRole === 'hole'
                  ? '#dedbd2'
                  : 'none'
            }
            fillRule="evenodd"
            stroke={strokeByOperation.get(path.operation) ?? '#222222'}
            strokeWidth={selected || entitySelected ? 0.65 : 0.35}
            vectorEffect="non-scaling-stroke"
            data-operation={path.operation}
            data-slot={path.slot ? 'true' : undefined}
            data-panel-id={path.panelId}
            data-edge-id={path.edgeId}
            data-tab-id={path.tabId}
            onClick={
              entityId
                ? (event) => {
                    event.stopPropagation();
                    onSelectEntity(entityId);
                  }
                : undefined
            }
          />
        );
      })}
      {part.label && bounds ? (
        <text
          x={bounds.minX + 2}
          y={bounds.minY + 4}
          fontSize="3"
          fill="#1f2724"
          pointerEvents="none"
        >
          {part.label}
        </text>
      ) : null}
      {part.labels?.map((label) => {
        const point = transformPoint(label.position, placement);
        const entitySelected = label.entityId === selectedEntityId;
        return (
          <text
            key={label.id}
            x={point.x}
            y={point.y}
            fontSize="2.4"
            textAnchor="middle"
            fill={entitySelected ? '#d85c2f' : '#1f2724'}
            data-operation={label.operation}
            data-entity-id={label.entityId}
            onClick={
              label.entityId
                ? (event) => {
                    event.stopPropagation();
                    onSelectEntity(label.entityId!);
                  }
                : undefined
            }
          >
            {label.text}
          </text>
        );
      })}
    </g>
  );
}

export function TwoViewport() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragState>();
  const project = useProjectStore((state) => state.project);
  const activeSheetId = useProjectStore((state) => state.activeSheetId);
  const selectedEntityId = useProjectStore((state) => state.selectedEntityId);
  const validationIssues = useProjectStore((state) => state.validationIssues);
  const selectEntity = useProjectStore((state) => state.selectEntity);
  const setActiveSheet = useProjectStore((state) => state.setActiveSheet);
  const updatePartPlacement = useProjectStore((state) => state.updatePartPlacement);
  const sheet =
    project.sheetLayouts.find((candidate) => candidate.id === activeSheetId) ??
    project.sheetLayouts[0];
  if (!sheet) return null;

  const partsById = new Map(project.generatedParts.map((part) => [part.id, part]));
  const invalidIds = new Set(
    validationIssues
      .filter((issue) =>
        ['PART_OUTSIDE_SHEET', 'PART_CROSSES_MARGIN', 'PARTS_OVERLAP'].includes(issue.code),
      )
      .flatMap((issue) => issue.affectedEntityIds),
  );
  const strokeByOperation = new Map(
    project.exportSettings.operationStyles.map((style) => [style.operation, style.stroke]),
  );
  const placements = sheet.placements.flatMap((placement) => {
    const part = partsById.get(placement.partId);
    if (!part) return [];
    const preview =
      drag?.partId === placement.partId ? { ...placement, x: drag.x, y: drag.y } : placement;
    return [{ part, placement: preview }];
  });

  const beginDrag = (event: PointerEvent<SVGGElement>, placement: SheetPlacement) => {
    const svg = svgRef.current;
    if (!svg) return;
    const start = screenPoint(svg, event.clientX, event.clientY);
    if (!start) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    selectEntity(placement.partId);
    setDrag({
      partId: placement.partId,
      pointerId: event.pointerId,
      start,
      originX: placement.x,
      originY: placement.y,
      x: placement.x,
      y: placement.y,
    });
  };
  const continueDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const point = screenPoint(event.currentTarget, event.clientX, event.clientY);
    if (!point) return;
    setDrag({
      ...drag,
      x: drag.originX + point.x - drag.start.x,
      y: drag.originY + point.y - drag.start.y,
    });
  };
  const finishDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    updatePartPlacement(sheet.id, drag.partId, { x: drag.x, y: drag.y });
    setDrag(undefined);
  };

  return (
    <section
      className="viewport-stage two-stage sheet-layout-stage"
      aria-label={copy.layoutPreview}
    >
      <div className="viewport-toolbar sheet-tabs" aria-label="Sheets">
        {project.sheetLayouts.map((candidate, index) => (
          <button
            type="button"
            className={candidate.id === sheet.id ? 'is-selected' : undefined}
            aria-pressed={candidate.id === sheet.id}
            onClick={() => setActiveSheet(candidate.id)}
            key={candidate.id}
          >
            Sheet {index + 1}
          </button>
        ))}
      </div>
      <svg
        ref={svgRef}
        className="sheet-preview interactive-sheet"
        viewBox={`0 0 ${sheet.widthMm} ${sheet.heightMm}`}
        aria-label={`${sheet.widthMm} by ${sheet.heightMm} millimetre sheet`}
        onPointerMove={continueDrag}
        onPointerUp={finishDrag}
        onPointerCancel={() => setDrag(undefined)}
      >
        <rect
          x="0.5"
          y="0.5"
          width={Math.max(0, sheet.widthMm - 1)}
          height={Math.max(0, sheet.heightMm - 1)}
          fill="#fffdf8"
          stroke="#315c52"
          vectorEffect="non-scaling-stroke"
        />
        <rect
          x={sheet.marginMm}
          y={sheet.marginMm}
          width={Math.max(0, sheet.widthMm - sheet.marginMm * 2)}
          height={Math.max(0, sheet.heightMm - sheet.marginMm * 2)}
          fill="none"
          stroke="#b4aea0"
          strokeDasharray="3 2"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
        {placements.map(({ part, placement }) => (
          <PartOnSheet
            key={part.id}
            part={part}
            placement={placement}
            selected={selectedEntityId === part.id}
            selectedEntityId={selectedEntityId}
            invalid={invalidIds.has(part.id)}
            strokeByOperation={strokeByOperation}
            onPointerDown={(event) => beginDrag(event, placement)}
            onSelect={() => selectEntity(part.id)}
            onSelectEntity={selectEntity}
          />
        ))}
      </svg>
      {project.generatedParts.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-mark" aria-hidden="true">
            ⌁
          </span>
          <h2>{copy.noPartsTitle}</h2>
          <p>{copy.noPartsBody}</p>
        </div>
      ) : placements.length === 0 ? (
        <div className="empty-state">
          <h2>This sheet is empty</h2>
          <p>Select an unplaced part or arrange all parts from the layout panel.</p>
        </div>
      ) : null}
    </section>
  );
}
