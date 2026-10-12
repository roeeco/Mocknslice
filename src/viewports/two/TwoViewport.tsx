import { useDisplayedProjectField } from '../PreviewProject';
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
import { assemblySelectionPanelIds } from '../../domain/assembly';
import { transformPoint, transformedBoundsForPart } from '../../geometry/layout/partPlacement';
import { deriveTightOutputLayout } from '../../geometry/layout/deriveTightOutputLayout';
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
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

function clampZoom(value: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
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
  relatedPanelIds,
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
  relatedPanelIds: ReadonlySet<string>;
  onSelectEntity: (id: string, ownerPartId?: string) => void;
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
        const entityId = path.featureId ?? path.tabId ?? path.edgeId ?? path.panelId;
        const entitySelected = [path.featureId, path.tabId, path.edgeId, path.panelId].includes(
          selectedEntityId,
        );
        const receiverSelected = path.panelId ? relatedPanelIds.has(path.panelId) : false;
        const style = styleByOperation.get(path.operation);
        return (
          <path
            key={path.id}
            d={pathData(path.points, placement, path.closed)}
            fill={
              path.tabId
                ? 'url(#tab-hatch)'
                : path.contourRole === 'outer'
                  ? '#f8f5ed'
                  : path.contourRole === 'hole'
                    ? '#dedbd2'
                    : 'none'
            }
            fillRule="evenodd"
            stroke={style?.stroke ?? '#222222'}
            strokeWidth={
              selected || entitySelected || receiverSelected
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
            data-feature-id={path.featureId}
            onClick={
              entityId
                ? (event) => {
                    event.stopPropagation();
                    onSelectEntity(entityId, part.id);
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
                fontSize={label.fontSizeMm ?? labelFontSizeMm}
                transform={
                  (label.rotationDeg ?? 0) + placement.rotationDeg
                    ? `rotate(${(label.rotationDeg ?? 0) + placement.rotationDeg} ${point.x} ${point.y})`
                    : undefined
                }
                textAnchor="middle"
                fill={entitySelected ? '#d85c2f' : '#1f2724'}
                data-operation={label.operation}
                data-entity-id={label.entityId}
                data-feature-id={label.featureId}
                onClick={
                  label.entityId
                    ? (event) => {
                        event.stopPropagation();
                        onSelectEntity(label.entityId!, part.id);
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
  const [storedView, setStoredView] = useState<ViewState>();
  const project = useDisplayedProjectField((project) => project);
  const experienceMode = useProjectStore((state) => state.experienceMode);
  const activeSheetId = useProjectStore((state) => state.activeSheetId);
  const selectedEntityId = useProjectStore((state) => state.selectedEntityId);
  const validationIssues = useProjectStore((state) => state.validationIssues);
  const selectEntity = useProjectStore((state) => state.selectEntity);
  const selectedPartId = useProjectStore((state) => state.selectedPartId);
  const setActiveSheet = useProjectStore((state) => state.setActiveSheet);
  const updatePartPlacement = useProjectStore((state) => state.updatePartPlacement);
  const preparedParts = useMemo(() => prepareFabricationOutput(project).parts, [project]);
  const layouts = useMemo(
    () =>
      experienceMode === 'standard'
        ? [deriveTightOutputLayout(preparedParts)]
        : project.sheetLayouts,
    [experienceMode, preparedParts, project.sheetLayouts],
  );
  const relatedPanelIds = assemblySelectionPanelIds(project, selectedEntityId);
  const sheet = layouts.find((candidate) => candidate.id === activeSheetId) ?? layouts[0];

  if (!sheet) return null;

  const view =
    storedView?.sheetId === sheet.id
      ? storedView
      : {
          sheetId: sheet.id,
          zoom: 1,
        };
  const zoom = view.zoom;
  const sheetAspectRatio = sheet.widthMm / sheet.heightMm;

  const partsById = new Map(preparedParts.map((part) => [part.id, part]));
  const invalidIds = new Set(
    experienceMode === 'standard'
      ? []
      : validationIssues
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
    if (experienceMode === 'standard' || event.button !== 0) return;
    const svg = svgRef.current;
    if (!svg) return;
    const start = screenPoint(svg, event.clientX, event.clientY);
    if (!start) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    selectEntity(placement.partId, placement.partId);
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
  const setZoom = (requestedZoom: number) => {
    const nextZoom = clampZoom(requestedZoom);
    setStoredView({
      sheetId: sheet.id,
      zoom: nextZoom,
    });
  };
  const resetView = () =>
    setStoredView({
      sheetId: sheet.id,
      zoom: 1,
    });
  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const delta =
      event.deltaMode === 1
        ? event.deltaY * 16
        : event.deltaMode === 2
          ? event.deltaY * event.currentTarget.clientHeight
          : event.deltaY;
    setZoom(zoom * Math.exp(-delta * 0.002));
  };
  const continuePointerInteraction = (event: PointerEvent<SVGSVGElement>) => {
    if (experienceMode === 'advanced' && drag && event.pointerId === drag.pointerId) {
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
    if (experienceMode === 'advanced' && drag && event.pointerId === drag.pointerId) {
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
        {layouts.map((candidate, index) => (
          <button
            type="button"
            className={candidate.id === sheet.id ? 'is-selected' : undefined}
            aria-pressed={candidate.id === sheet.id}
            onClick={() => experienceMode === 'advanced' && setActiveSheet(candidate.id)}
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
          onClick={() => setZoom(zoom - ZOOM_STEP)}
        >
          −
        </button>
        <output aria-label={copy.zoomLevel}>{Math.round(zoom * 100)}%</output>
        <button
          type="button"
          aria-label={copy.zoomIn}
          title={copy.zoomIn}
          disabled={zoom >= MAX_ZOOM}
          onClick={() => setZoom(zoom + ZOOM_STEP)}
        >
          +
        </button>
        <button type="button" onClick={resetView}>
          {copy.fitSheet}
        </button>
      </div>
      <div className="sheet-document-stage">
        <svg
          ref={svgRef}
          className="sheet-preview interactive-sheet"
          viewBox={`0 0 ${decimal(sheet.widthMm)} ${decimal(sheet.heightMm)}`}
          style={{
            width: `min(${80 * zoom}%, ${76 * sheetAspectRatio * zoom}vh, ${660 * sheetAspectRatio * zoom}px)`,
            height: 'auto',
          }}
          data-zoom={zoom}
          aria-label={`${sheet.widthMm} by ${sheet.heightMm} millimetre sheet`}
          aria-describedby="sheet-navigation-help"
          onWheel={handleWheel}
          onPointerMove={continuePointerInteraction}
          onPointerUp={finishPointerInteraction}
          onPointerCancel={() => setDrag(undefined)}
        >
          <defs>
            <pattern
              id="tab-hatch"
              width="3"
              height="3"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(35)"
            >
              <rect width="3" height="3" fill="#d85c2f" fillOpacity="0.13" />
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="3"
                stroke="#d85c2f"
                strokeOpacity="0.55"
                strokeWidth="0.45"
              />
            </pattern>
          </defs>
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
              selected={selectedPartId === part.id}
              selectedEntityId={selectedEntityId}
              relatedPanelIds={relatedPanelIds}
              invalid={invalidIds.has(part.id)}
              styleByOperation={styleByOperation}
              labelFontSizeMm={project.exportSettings.labelFontSizeMm}
              includeLabels={project.exportSettings.includeLabels}
              onPointerDown={(event) => beginDrag(event, placement)}
              onSelect={() => selectEntity(part.id, part.id)}
              onSelectEntity={selectEntity}
            />
          ))}
        </svg>
      </div>
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
