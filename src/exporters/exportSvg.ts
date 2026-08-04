import type { FabricationPart, SheetLayout, SheetPlacement } from '../domain/fabrication';
import type { Point2D } from '../domain/geometry';
import type { OperationType } from '../domain/operations';
import type { ProjectData } from '../domain/project';
import { transformPoint, transformedBoundsForPart } from '../geometry/layout/partPlacement';
import {
  createRegistrationMarkPaths,
  prepareFabricationOutput,
} from '../geometry/output/prepareFabricationOutput';
import { CURRENT_PROJECT_FILE_VERSION } from './exportProject';
import { BRAND } from '../config/brand';

const operations: OperationType[] = [
  'cut',
  'score',
  'mountain-fold',
  'valley-fold',
  'perforate',
  'engrave',
  'guide',
];
const MARGIN_MM = 5;
const PART_GAP_MM = 5;

interface PartPlacement {
  part: FabricationPart;
  offsetX: number;
  offsetY: number;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function decimal(value: number): string {
  return String(Math.round(value * 1_000_000) / 1_000_000);
}

function pathEntityAttributes(path: FabricationPart['paths'][number]): string {
  return [
    path.panelId ? ` data-panel-id="${escapeXml(path.panelId)}"` : '',
    path.edgeId ? ` data-edge-id="${escapeXml(path.edgeId)}"` : '',
    path.tabId ? ` data-tab-id="${escapeXml(path.tabId)}"` : '',
  ].join('');
}

function pointBounds(points: Point2D[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
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

function partBounds(part: FabricationPart) {
  return pointBounds(part.paths.flatMap((path) => path.points));
}

function pathData(points: Point2D[], offsetX: number, offsetY: number, closed: boolean): string {
  if (points.length === 0) return '';
  const commands = points.map(
    (point, index) =>
      `${index === 0 ? 'M' : 'L'} ${decimal(point.x + offsetX)} ${decimal(point.y + offsetY)}`,
  );
  return `${commands.join(' ')}${closed ? ' Z' : ''}`;
}

export function createSvgDocument(project: ProjectData): string {
  const prepared = prepareFabricationOutput(project);
  const blockingIssue = prepared.issues.find((issue) => issue.severity === 'error');
  if (blockingIssue) throw new Error(blockingIssue.message);
  let cursorX = MARGIN_MM;
  let contentHeight = 0;
  const placements: PartPlacement[] = prepared.parts
    .filter((part) => part.paths.some((path) => path.points.length > 0))
    .map((part) => {
      const bounds = partBounds(part);
      const width = bounds.maxX - bounds.minX;
      const height = bounds.maxY - bounds.minY;
      const placement = {
        part,
        offsetX: cursorX - bounds.minX,
        offsetY: MARGIN_MM - bounds.minY,
      };
      cursorX += width + PART_GAP_MM;
      contentHeight = Math.max(contentHeight, height);
      return placement;
    });
  const widthMm = Math.max(MARGIN_MM * 2, cursorX - PART_GAP_MM + MARGIN_MM);
  const heightMm = Math.max(MARGIN_MM * 2, contentHeight + MARGIN_MM * 2);
  const styleByOperation = new Map(
    project.exportSettings.operationStyles.map((style) => [style.operation, style]),
  );
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${decimal(widthMm)}mm" height="${decimal(heightMm)}mm" viewBox="0 0 ${decimal(widthMm)} ${decimal(heightMm)}">`,
    `  <metadata>${escapeXml(JSON.stringify({ application: BRAND.svgApplicationName, projectFormatVersion: CURRENT_PROJECT_FILE_VERSION, projectId: project.metadata.id, mode: project.fabricationMode, units: 'mm', kerfMm: prepared.appliedKerfMm, foldLineOutput: project.exportSettings.foldLineOutput }))}</metadata>`,
  ];
  if (project.exportSettings.includeSheetBoundary) {
    lines.push(
      `  <rect id="sheet-boundary" x="0.05" y="0.05" width="${decimal(widthMm - 0.1)}" height="${decimal(heightMm - 0.1)}" fill="none" stroke="#777777" stroke-width="0.1"/>`,
    );
  }
  for (const operation of operations) {
    const style = styleByOperation.get(operation);
    lines.push(
      `  <g id="operation-${operation}" data-operation="${operation}" fill="none" stroke="${escapeXml(style?.stroke ?? '#000000')}" stroke-width="${decimal(style?.strokeWidthMm ?? 0.1)}">`,
    );
    for (const placement of placements) {
      for (const path of placement.part.paths.filter(
        (candidate) => candidate.operation === operation,
      )) {
        lines.push(
          `    <path id="${escapeXml(path.id)}" data-part-id="${escapeXml(placement.part.id)}" data-contour-role="${path.contourRole ?? 'path'}"${pathEntityAttributes(path)} d="${pathData(path.points, placement.offsetX, placement.offsetY, path.closed)}"/>`,
        );
      }
      if (project.exportSettings.includeLabels) {
        for (const label of placement.part.labels?.filter(
          (candidate) => candidate.operation === operation,
        ) ?? []) {
          lines.push(
            `    <text id="${escapeXml(label.id)}" data-part-id="${escapeXml(placement.part.id)}"${label.entityId ? ` data-entity-id="${escapeXml(label.entityId)}"` : ''} x="${decimal(label.position.x + placement.offsetX)}" y="${decimal(label.position.y + placement.offsetY)}" fill="${escapeXml(style?.stroke ?? '#000000')}" stroke="none" font-family="sans-serif" font-size="${decimal(project.exportSettings.labelFontSizeMm)}" text-anchor="middle">${escapeXml(label.text)}</text>`,
          );
        }
      }
    }
    lines.push('  </g>');
  }
  if (project.exportSettings.includeLabels) {
    lines.push(
      `  <g id="part-labels" data-operation="engrave" fill="#000000" stroke="none" font-family="sans-serif" font-size="${decimal(project.exportSettings.labelFontSizeMm)}">`,
    );
    for (const placement of placements) {
      if (!placement.part.label) continue;
      const bounds = partBounds(placement.part);
      lines.push(
        `    <text id="label-${escapeXml(placement.part.id)}" x="${decimal(bounds.minX + placement.offsetX + 2)}" y="${decimal(bounds.minY + placement.offsetY + 4)}">${escapeXml(placement.part.label)}</text>`,
      );
    }
    lines.push('  </g>');
  }
  lines.push('</svg>', '');
  return lines.join('\n');
}

export function createSvgDownload(project: ProjectData): void {
  const blob = new Blob([createSvgDocument(project)], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const safeName = project.metadata.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  anchor.href = url;
  anchor.download = `${safeName || 'mocknslice-parts'}.svg`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function placedPathData(points: Point2D[], placement: SheetPlacement, closed: boolean): string {
  if (points.length === 0) return '';
  const commands = points.map((point, index) => {
    const transformed = transformPoint(point, placement);
    return `${index === 0 ? 'M' : 'L'} ${decimal(transformed.x)} ${decimal(transformed.y)}`;
  });
  return `${commands.join(' ')}${closed ? ' Z' : ''}`;
}

export function createSheetSvgDocument(
  project: ProjectData,
  sheetId: string,
  layouts: readonly SheetLayout[] = project.sheetLayouts,
): string {
  const sheet = layouts.find((candidate) => candidate.id === sheetId);
  if (!sheet) throw new Error(`Sheet ${sheetId} does not exist.`);
  const prepared = prepareFabricationOutput(project);
  const blockingIssue = prepared.issues.find((issue) => issue.severity === 'error');
  if (blockingIssue) throw new Error(blockingIssue.message);
  const partsById = new Map(prepared.parts.map((part) => [part.id, part]));
  const placements = sheet.placements.flatMap((placement) => {
    const part = partsById.get(placement.partId);
    return part ? [{ part, placement }] : [];
  });
  const styleByOperation = new Map(
    project.exportSettings.operationStyles.map((style) => [style.operation, style]),
  );
  const sheetIndex = layouts.findIndex((candidate) => candidate.id === sheetId);
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${decimal(sheet.widthMm)}mm" height="${decimal(sheet.heightMm)}mm" viewBox="0 0 ${decimal(sheet.widthMm)} ${decimal(sheet.heightMm)}">`,
    `  <metadata>${escapeXml(JSON.stringify({ application: BRAND.svgApplicationName, projectFormatVersion: CURRENT_PROJECT_FILE_VERSION, projectId: project.metadata.id, mode: project.fabricationMode, units: 'mm', sheetId: sheet.id, sheetNumber: sheetIndex + 1, kerfMm: prepared.appliedKerfMm, foldLineOutput: project.exportSettings.foldLineOutput }))}</metadata>`,
  ];
  if (project.exportSettings.includeSheetBoundary) {
    lines.push(
      `  <rect id="sheet-boundary" x="0.05" y="0.05" width="${decimal(Math.max(0, sheet.widthMm - 0.1))}" height="${decimal(Math.max(0, sheet.heightMm - 0.1))}" fill="none" stroke="#777777" stroke-width="0.1"/>`,
    );
  }
  for (const operation of operations) {
    const style = styleByOperation.get(operation);
    lines.push(
      `  <g id="operation-${operation}" data-operation="${operation}" fill="none" stroke="${escapeXml(style?.stroke ?? '#000000')}" stroke-width="${decimal(style?.strokeWidthMm ?? 0.1)}">`,
    );
    for (const { part, placement } of placements) {
      for (const path of part.paths.filter((candidate) => candidate.operation === operation)) {
        lines.push(
          `    <path id="${escapeXml(path.id)}" data-part-id="${escapeXml(part.id)}" data-contour-role="${path.contourRole ?? 'path'}"${pathEntityAttributes(path)} d="${placedPathData(path.points, placement, path.closed)}"/>`,
        );
      }
      if (project.exportSettings.includeLabels) {
        for (const label of part.labels?.filter((candidate) => candidate.operation === operation) ??
          []) {
          const point = transformPoint(label.position, placement);
          lines.push(
            `    <text id="${escapeXml(label.id)}" data-part-id="${escapeXml(part.id)}"${label.entityId ? ` data-entity-id="${escapeXml(label.entityId)}"` : ''} x="${decimal(point.x)}" y="${decimal(point.y)}" fill="${escapeXml(style?.stroke ?? '#000000')}" stroke="none" font-family="sans-serif" font-size="${decimal(project.exportSettings.labelFontSizeMm)}" text-anchor="middle">${escapeXml(label.text)}</text>`,
          );
        }
      }
    }
    if (operation === 'guide' && project.exportSettings.includeRegistrationMarks) {
      for (const path of createRegistrationMarkPaths(sheet)) {
        lines.push(
          `    <path id="${escapeXml(path.id)}" data-registration-mark="true" d="${pathData(path.points, 0, 0, false)}"/>`,
        );
      }
    }
    lines.push('  </g>');
  }
  if (project.exportSettings.includeLabels) {
    lines.push(
      `  <g id="part-labels" data-operation="engrave" fill="#000000" stroke="none" font-family="sans-serif" font-size="${decimal(project.exportSettings.labelFontSizeMm)}">`,
    );
    for (const { part, placement } of placements) {
      if (!part.label) continue;
      const bounds = transformedBoundsForPart(part, placement);
      if (!bounds) continue;
      lines.push(
        `    <text id="label-${escapeXml(part.id)}" x="${decimal(bounds.minX + 2)}" y="${decimal(bounds.minY + 4)}">${escapeXml(part.label)}</text>`,
      );
    }
    lines.push('  </g>');
  }
  lines.push('</svg>', '');
  return lines.join('\n');
}

export function createSheetSvgDownload(
  project: ProjectData,
  sheetId: string,
  layouts: readonly SheetLayout[] = project.sheetLayouts,
): void {
  const sheetIndex = layouts.findIndex((sheet) => sheet.id === sheetId);
  if (sheetIndex < 0) return;
  const blob = new Blob([createSheetSvgDocument(project, sheetId, layouts)], {
    type: 'image/svg+xml',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const safeName = project.metadata.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  anchor.href = url;
  anchor.download = `${safeName || 'mocknslice'}-sheet-${sheetIndex + 1}.svg`;
  anchor.click();
  URL.revokeObjectURL(url);
}
