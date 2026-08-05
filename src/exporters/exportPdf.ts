import type { FabricationPart, SheetLayout, SheetPlacement } from '../domain/fabrication';
import type { Point2D } from '../domain/geometry';
import type { OperationType } from '../domain/operations';
import type { ProjectData } from '../domain/project';
import { transformPoint, transformedBoundsForPart } from '../geometry/layout/partPlacement';
import {
  createRegistrationMarkPaths,
  prepareFabricationOutput,
} from '../geometry/output/prepareFabricationOutput';
import { BRAND } from '../config/brand';

const MM_TO_POINTS = 72 / 25.4;
const operationOrder: OperationType[] = [
  'cut',
  'score',
  'mountain-fold',
  'valley-fold',
  'perforate',
  'engrave',
  'guide',
];

function pdfNumber(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

function ascii(value: string): string {
  return [...value]
    .map((character) =>
      character.charCodeAt(0) >= 32 && character.charCodeAt(0) <= 126 ? character : '?',
    )
    .join('');
}

function pdfText(value: string): string {
  return ascii(value).replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function rgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex)
    ? hex.slice(1)
    : /^#[0-9a-f]{3}$/i.test(hex)
      ? hex
          .slice(1)
          .split('')
          .map((character) => character + character)
          .join('')
      : '000000';
  return [0, 2, 4].map(
    (offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255,
  ) as [number, number, number];
}

function pointCommand(point: Point2D, heightMm: number, command: 'm' | 'l'): string {
  return `${pdfNumber(point.x * MM_TO_POINTS)} ${pdfNumber((heightMm - point.y) * MM_TO_POINTS)} ${command}`;
}

function pathCommands(
  points: readonly Point2D[],
  placement: SheetPlacement | undefined,
  closed: boolean,
  heightMm: number,
): string | undefined {
  if (points.length === 0) return undefined;
  const transformed = placement ? points.map((point) => transformPoint(point, placement)) : points;
  return `${transformed.map((point, index) => pointCommand(point, heightMm, index === 0 ? 'm' : 'l')).join('\n')}\n${closed ? 'h\n' : ''}S`;
}

function textCommand(
  text: string,
  point: Point2D,
  heightMm: number,
  fontSizeMm: number,
  rotationDeg = 0,
): string {
  const radians = (-rotationDeg * Math.PI) / 180;
  const cosine = pdfNumber(Math.cos(radians));
  const sine = pdfNumber(Math.sin(radians));
  return `BT /F1 ${pdfNumber(fontSizeMm * MM_TO_POINTS)} Tf ${cosine} ${sine} ${pdfNumber(-Math.sin(radians))} ${cosine} ${pdfNumber(point.x * MM_TO_POINTS)} ${pdfNumber((heightMm - point.y) * MM_TO_POINTS)} Tm (${pdfText(text)}) Tj ET`;
}

function pageContent(
  project: ProjectData,
  sheet: SheetLayout,
  sheetIndex: number,
  sheetCount: number,
  partsById: Map<string, FabricationPart>,
): string {
  const lines = ['q', '1 J 1 j'];
  const presentOperations = new Set<OperationType>();
  for (const placement of sheet.placements) {
    const part = partsById.get(placement.partId);
    for (const path of part?.paths ?? []) {
      presentOperations.add(path.operation);
    }
    if (project.exportSettings.includeLabels && (part?.label || part?.labels?.length)) {
      presentOperations.add('engrave');
    }
  }
  if (project.exportSettings.includeRegistrationMarks) presentOperations.add('guide');
  if (project.exportSettings.includeSheetBoundary) {
    lines.push(
      '0.45 0.45 0.45 RG',
      `${pdfNumber(0.1 * MM_TO_POINTS)} w`,
      `${pdfNumber(0.05 * MM_TO_POINTS)} ${pdfNumber(0.05 * MM_TO_POINTS)} ${pdfNumber((sheet.widthMm - 0.1) * MM_TO_POINTS)} ${pdfNumber((sheet.heightMm - 0.1) * MM_TO_POINTS)} re S`,
    );
  }
  for (const operation of operationOrder) {
    const style = project.exportSettings.operationStyles.find(
      (candidate) => candidate.operation === operation,
    );
    const [red, green, blue] = rgb(style?.stroke ?? '#000000');
    lines.push(
      `${pdfNumber(red)} ${pdfNumber(green)} ${pdfNumber(blue)} RG`,
      `${pdfNumber((style?.strokeWidthMm ?? 0.1) * MM_TO_POINTS)} w`,
    );
    for (const placement of sheet.placements) {
      const part = partsById.get(placement.partId);
      if (!part) continue;
      for (const path of part.paths.filter((candidate) => candidate.operation === operation)) {
        const commands = pathCommands(path.points, placement, path.closed, sheet.heightMm);
        if (commands) lines.push(commands);
      }
      if (project.exportSettings.includeLabels) {
        for (const label of part.labels?.filter((candidate) => candidate.operation === operation) ??
          []) {
          lines.push(
            textCommand(
              label.text,
              transformPoint(label.position, placement),
              sheet.heightMm,
              label.fontSizeMm ?? project.exportSettings.labelFontSizeMm,
              (label.rotationDeg ?? 0) + placement.rotationDeg,
            ),
          );
        }
      }
    }
    if (operation === 'guide' && project.exportSettings.includeRegistrationMarks) {
      for (const mark of createRegistrationMarkPaths(sheet)) {
        const commands = pathCommands(mark.points, undefined, false, sheet.heightMm);
        if (commands) lines.push(commands);
      }
    }
  }
  if (project.exportSettings.includeLabels) {
    lines.push('0 0 0 rg');
    for (const placement of sheet.placements) {
      const part = partsById.get(placement.partId);
      if (!part?.label) continue;
      const bounds = transformedBoundsForPart(part, placement);
      if (!bounds) continue;
      lines.push(
        textCommand(
          part.label,
          { x: bounds.minX + 2, y: bounds.minY + project.exportSettings.labelFontSizeMm + 1 },
          sheet.heightMm,
          project.exportSettings.labelFontSizeMm,
        ),
      );
    }
  }
  lines.push(
    '0 0 0 rg',
    textCommand(
      `${project.metadata.name} - sheet ${sheetIndex + 1} of ${sheetCount}`,
      { x: Math.max(2, sheet.marginMm), y: Math.max(3, sheet.marginMm * 0.65) },
      sheet.heightMm,
      2.5,
    ),
    textCommand(
      `Operations: ${operationOrder.filter((operation) => presentOperations.has(operation)).join(', ')}`,
      { x: Math.max(2, sheet.marginMm), y: Math.max(6, sheet.marginMm * 0.65 + 3) },
      sheet.heightMm,
      1.8,
    ),
    'Q',
  );
  return `${lines.join('\n')}\n`;
}

export function createAssemblyPdf(
  project: ProjectData,
  layouts: readonly SheetLayout[] = project.sheetLayouts,
): Uint8Array {
  const sheets = layouts.filter((sheet) => sheet.placements.length > 0);
  if (sheets.length === 0) throw new Error('Place at least one part before exporting a PDF.');
  const prepared = prepareFabricationOutput(project);
  const blockingIssue = prepared.issues.find((issue) => issue.severity === 'error');
  if (blockingIssue) throw new Error(blockingIssue.message);
  const partsById = new Map(prepared.parts.map((part) => [part.id, part]));
  const pageLayouts = layouts.filter((sheet) => sheet.placements.length > 0);
  const fontObject = 3;
  const infoObject = 4 + pageLayouts.length * 2;
  const objects = new Map<number, string>();
  objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  const pageReferences = pageLayouts.map((_, index) => `${4 + index * 2} 0 R`).join(' ');
  objects.set(2, `<< /Type /Pages /Kids [${pageReferences}] /Count ${pageLayouts.length} >>`);
  objects.set(fontObject, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  pageLayouts.forEach((sheet, outputIndex) => {
    const pageObject = 4 + outputIndex * 2;
    const contentObject = pageObject + 1;
    const content = pageContent(project, sheet, outputIndex, pageLayouts.length, partsById);
    objects.set(
      pageObject,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfNumber(sheet.widthMm * MM_TO_POINTS)} ${pdfNumber(sheet.heightMm * MM_TO_POINTS)}] /Resources << /Font << /F1 ${fontObject} 0 R >> >> /Contents ${contentObject} 0 R >>`,
    );
    objects.set(
      contentObject,
      `<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}endstream`,
    );
  });
  objects.set(
    infoObject,
    `<< /Title (${pdfText(project.metadata.name)}) /Creator (${BRAND.pdfCreator}) /Producer (${BRAND.pdfCreator} fabrication output) >>`,
  );

  const encoder = new TextEncoder();
  let document = `%PDF-1.4\n% ${BRAND.name} vector assembly sheets\n`;
  const offsets: number[] = [0];
  for (let object = 1; object <= infoObject; object += 1) {
    offsets[object] = encoder.encode(document).length;
    document += `${object} 0 obj\n${objects.get(object) ?? '<< >>'}\nendobj\n`;
  }
  const xrefOffset = encoder.encode(document).length;
  document += `xref\n0 ${infoObject + 1}\n0000000000 65535 f \n`;
  for (let object = 1; object <= infoObject; object += 1) {
    document += `${String(offsets[object] ?? 0).padStart(10, '0')} 00000 n \n`;
  }
  document += `trailer\n<< /Size ${infoObject + 1} /Root 1 0 R /Info ${infoObject} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return encoder.encode(document);
}

export function createAssemblyPdfDownload(
  project: ProjectData,
  layouts: readonly SheetLayout[] = project.sheetLayouts,
): void {
  const bytes = createAssemblyPdf(project, layouts);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const safeName = project.metadata.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  anchor.href = url;
  anchor.download = `${safeName || 'mocknslice'}-assembly.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}
