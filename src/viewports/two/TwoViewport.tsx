import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from 'react';
import type { FabricationPart, SheetPlacement } from '../../domain/fabrication';
import type { Point2D } from '../../domain/geometry';
import type { OperationStyle } from '../../domain/operations';
import { transformPoint, transformedBoundsForPart } from '../../geometry/layout/partPlacement';
import {
  createRegistrationMarkPaths,
  prepareFabricationOutput,
} from '../../geometry/output/prepareFabricationOutput';
import { copy, t } from '../../locales';
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

interface ViewState {
  sheetId: string;
  zoom: number;
  centerX: number;
  centerY: number;
}

interface PanState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  originCenterX: number;
  originCenterY: number;
  unitsPerPixelX: number;
  unitsPerPixelY: number;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

function clampZoom(value: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

function clampCenter(center: number, sheetSize: number, viewSize: number) {
  if (viewSize >= sheetSize) return sheetSize / 2;
  return Math.max(viewSize / 2, Math.min(sheetSize - viewSize / 2, center));
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
  styleByOperation,
  labelFontSizeMm,
  includeLabels,
  onPointerDown,
  onSelect,
  onSelectEntity,
}: {
  part: FabricationPart;
  placement: SheetPlacement;
  selected: boolean;
  selectedEntityId: string | undefined;
  invalid: boolean;
  styleByOperation: Map<string, OperationStyle>;
  labelFontSizeMm: number;
  includeLabels: boolean;
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
        const style = styleByOperation.get(path.operation);
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
            stroke={style?.stroke ?? '#222222'}
            strokeWidth={
              selected || entitySelected
                ? Math.max(0.65, style?.strokeWidthMm ?? 0.35)
                : (style?.strokeWidthMm ?? 0.35)
            }
            vectorEffect="non-scaling-stroke"
            data-operation={path.operation}
            data-contour-role={path.contourRole}
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
      {includeLabels && part.label && bounds ? (
        <text
          x={bounds.minX + 2}
          y={bounds.minY + labelFontSizeMm + 1}
          fontSize={labelFontSizeMm}
          fill="#1f2724"
          pointerEvents="none"
        >
          {part.label}
        </text>
      ) : null}
      {includeLabels
        ? part.labels?.map((label) => {
            const point = transformPoint(label.position, placement);
            const entitySelected = label.entityId === selectedEntityId;
            return (
              <text
                key={label.id}
                x={point.x}
                y={point.y}
                fontSize={labelFontSizeMm}
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
          })
        : null}
    </g>
  );
}

export function TwoViewport() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragState>();
  const [pan, setPan] = useState<PanState>();
  const [storedView, setStoredView] = useState<ViewState>();
  const project = useProjectStore((state) => state.project);
  const activeSheetId = useProjectStore((state) => state.activeSheetId);
  const selectedEntityId = useProjectStore((state) => state.selectedEntityId);
  const validationIssues = useProjectStore((state) => state.validationIssues);
  const selectEntity = useProjectStore((state) => state.selectEntity);
  const setActiveSheet = useProjectStore((state) => state.setActiveSheet);
  const updatePartPlacement = useProjectStore((state) => state.updatePartPlacement);
  const preparedParts = useMemo(() => prepareFabricationOutput(project).parts, [project]);
  const sheet =
    project.sheetLayouts.find((candidate) => candidate.id === activeSheetId) ??
    project.sheetLayouts[0];

  if (!sheet) return null;

  const view =
    storedView?.sheetId === sheet.id
      ? storedView
      : {
          sheetId: sheet.id,
          zoom: 1,
          centerX: sheet.widthMm / 2,
          centerY: sheet.heightMm / 2,
        };
  const zoom = view.zoom;
  const viewWidth = sheet.widthMm / zoom;
  const viewHeight = sheet.heightMm / zoom;
  const viewX = view.centerX - viewWidth / 2;
  const viewY = view.centerY - viewHeight / 2;

  const partsById = new Map(preparedParts.map((part) => [part.id, part]));
  const invalidIds = new Set(
    validationIssues
      .filter((issue) =>
        ['PART_OUTSIDE_SHEET', 'PART_CROSSES_MARGIN', 'PARTS_OVERLAP'].includes(issue.code),
      )
      .flatMap((issue) => issue.affectedEntityIds),
  );
  const styleByOperation = new Map(
    project.exportSettings.operationStyles.map((style) => [style.operation, style]),
  );
  const placements = sheet.placements.flatMap((placement) => {
    const part = partsById.get(placement.partId);
    if (!part) return [];
    const preview =
      drag?.partId === placement.partId ? { ...placement, x: drag.x, y: drag.y } : placement;
    return [{ part, placement: preview }];
  });

  const beginDrag = (event: PointerEvent<SVGGElement>, placement: SheetPlacement) => {
    if (event.button !== 0) return;
    const svg = svgRef.current;
    if (!svg) return;
    const start = screenPoint(svg, event.clientX, event.clientY);
    if (!start) return;
    event.preventDefault();
    event.stopPropagation();
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
  const setZoomAt = (requestedZoom: number, focus?: Point2D) => {
    const nextZoom = clampZoom(requestedZoom);
    const anchor = focus ?? { x: view.centerX, y: view.centerY };
    const relativeX = (anchor.x - viewX) / viewWidth;
    const relativeY = (anchor.y - viewY) / viewHeight;
    const nextViewWidth = sheet.widthMm / nextZoom;
    const nextViewHeight = sheet.heightMm / nextZoom;
    const nextCenterX = anchor.x - (relativeX - 0.5) * nextViewWidth;
    const nextCenterY = anchor.y - (relativeY - 0.5) * nextViewHeight;
    setStoredView({
      sheetId: sheet.id,
      zoom: nextZoom,
      centerX: clampCenter(nextCenterX, sheet.widthMm, nextViewWidth),
      centerY: clampCenter(nextCenterY, sheet.heightMm, nextViewHeight),
    });
  };
  const resetView = () =>
    setStoredView({
      sheetId: sheet.id,
      zoom: 1,
      centerX: sheet.widthMm / 2,
      centerY: sheet.heightMm / 2,
    });
  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    const focus = screenPoint(event.currentTarget, event.clientX, event.clientY);
    if (!focus) return;
    event.preventDefault();
    const delta =
      event.deltaMode === 1
        ? event.deltaY * 16
        : event.deltaMode === 2
          ? event.deltaY * event.currentTarget.clientHeight
          : event.deltaY;
    setZoomAt(zoom * Math.exp(-delta * 0.002), focus);
  };
  const beginPan = (event: PointerEvent<SVGSVGElement>) => {
    const target = event.target as Element;
    if (event.button === 0 && target.closest('.sheet-part')) return;
    if (event.button !== 0 && event.button !== 1) return;
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix || matrix.a === 0 || matrix.d === 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setPan({
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originCenterX: view.centerX,
      originCenterY: view.centerY,
      unitsPerPixelX: Math.abs(1 / matrix.a),
      unitsPerPixelY: Math.abs(1 / matrix.d),
    });
  };
  const continuePointerInteraction = (event: PointerEvent<SVGSVGElement>) => {
    if (pan && event.pointerId === pan.pointerId) {
      const nextCenterX =
        pan.originCenterX - (event.clientX - pan.startClientX) * pan.unitsPerPixelX;
      const nextCenterY =
        pan.originCenterY - (event.clientY - pan.startClientY) * pan.unitsPerPixelY;
      setStoredView({
        sheetId: sheet.id,
        zoom,
        centerX: clampCenter(nextCenterX, sheet.widthMm, viewWidth),
        centerY: clampCenter(nextCenterY, sheet.heightMm, viewHeight),
      });
      return;
    }
    if (drag && event.pointerId === drag.pointerId) {
      const point = screenPoint(event.currentTarget, event.clientX, event.clientY);
      if (!point) return;
      setDrag({
        ...drag,
        x: drag.originX + point.x - drag.start.x,
        y: drag.originY + point.y - drag.start.y,
      });
    }
  };
  const finishPointerInteraction = (event: PointerEvent<SVGSVGElement>) => {
    if (pan && event.pointerId === pan.pointerId) {
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
      setPan(undefined);
      return;
    }
    if (drag && event.pointerId === drag.pointerId) {
      updatePartPlacement(sheet.id, drag.partId, { x: drag.x, y: drag.y });
      setDrag(undefined);
    }
  };

  return (
    <section
      className="viewport-stage two-stage sheet-layout-stage"
      aria-label={copy.layoutPreview}
    >
      <div className="viewport-toolbar sheet-tabs" aria-label={t('Sheets')}>
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
      <div className="viewport-toolbar zoom-toolbar" aria-label={copy.zoomControls}>
        <button
          type="button"
          aria-label={copy.zoomOut}
          title={copy.zoomOut}
          disabled={zoom <= MIN_ZOOM}
          onClick={() => setZoomAt(zoom - ZOOM_STEP)}
        >
          −
        </button>
        <output aria-label={copy.zoomLevel}>{Math.round(zoom * 100)}%</output>
        <button
          type="button"
          aria-label={copy.zoomIn}
          title={copy.zoomIn}
          disabled={zoom >= MAX_ZOOM}
          onClick={() => setZoomAt(zoom + ZOOM_STEP)}
        >
          +
        </button>
        <button type="button" onClick={resetView}>
          {copy.fitSheet}
        </button>
      </div>
      <svg
        ref={svgRef}
        className={`sheet-preview interactive-sheet${pan ? ' is-panning' : ''}`}
        viewBox={`${decimal(viewX)} ${decimal(viewY)} ${decimal(viewWidth)} ${decimal(viewHeight)}`}
        data-zoom={zoom}
        data-view-x={decimal(viewX)}
        data-view-y={decimal(viewY)}
        aria-label={`${sheet.widthMm} by ${sheet.heightMm} millimetre sheet`}
        aria-describedby="sheet-navigation-help"
        onWheel={handleWheel}
        onPointerDown={beginPan}
        onPointerMove={continuePointerInteraction}
        onPointerUp={finishPointerInteraction}
        onPointerCancel={() => {
          setDrag(undefined);
          setPan(undefined);
        }}
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
        {project.exportSettings.includeRegistrationMarks
          ? createRegistrationMarkPaths(sheet).map((path) => (
              <path
                key={path.id}
                d={pathData(
                  path.points,
                  { partId: 'registration', x: 0, y: 0, rotationDeg: 0 },
                  false,
                )}
                fill="none"
                stroke={styleByOperation.get('guide')?.stroke ?? '#6b7280'}
                strokeWidth={styleByOperation.get('guide')?.strokeWidthMm ?? 0.35}
                vectorEffect="non-scaling-stroke"
                data-registration-mark="true"
                pointerEvents="none"
              />
            ))
          : null}
        {placements.map(({ part, placement }) => (
          <PartOnSheet
            key={part.id}
            part={part}
            placement={placement}
            selected={selectedEntityId === part.id}
            selectedEntityId={selectedEntityId}
            invalid={invalidIds.has(part.id)}
            styleByOperation={styleByOperation}
            labelFontSizeMm={project.exportSettings.labelFontSizeMm}
            includeLabels={project.exportSettings.includeLabels}
            onPointerDown={(event) => beginDrag(event, placement)}
            onSelect={() => selectEntity(part.id)}
            onSelectEntity={selectEntity}
          />
        ))}
      </svg>
      <p className="visually-hidden" id="sheet-navigation-help">
        {copy.sheetNavigationHelp}
      </p>
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
          <h2>{t('This sheet is empty')}</h2>
          <p>{t('Select an unplaced part or arrange all parts from the layout panel.')}</p>
        </div>
      ) : null}
    </section>
  );
}
