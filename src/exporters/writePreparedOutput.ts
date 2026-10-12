import type { ExportReadiness } from '../geometry/output/evaluateExportReadiness';
import { createSheetSvgDocument } from './exportSvg';
import { createAssemblyPdf } from './exportPdf';
import type { PreparedFabricationOutput } from '../geometry/output/prepareFabricationOutput';
export interface PreparedArtifact {
  name: string;
  mimeType: string;
  data: string | Uint8Array;
}
function assertWritable(readiness: ExportReadiness, draft: boolean) {
  if (
    !Object.isFrozen(readiness) ||
    readiness.status === 'blocked' ||
    (!draft && readiness.status !== 'ready')
  )
    throw new Error('Output requires a frozen, validated and acknowledged fabrication snapshot.');
}
const safeName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'mocknslice';
function preparedFor(readiness: ExportReadiness, draft: boolean): PreparedFabricationOutput {
  return {
    ...readiness.prepared,
    issues: draft ? [] : readiness.prepared.issues,
    provenance: {
      schemaVersion: 9,
      algorithmVersion:
        readiness.projectSnapshot.generationRecord?.algorithmVersion ?? 'legacy-unverified',
      inputHash: readiness.sourceInputHash,
      snapshotHash: readiness.snapshotHash,
      profile: readiness.profile,
      draft,
    },
  };
}
export function writePreparedSvg(
  readiness: ExportReadiness,
  options: { draft?: boolean; sheetId?: string } = {},
): PreparedArtifact[] {
  const draft = options.draft ?? false;
  assertWritable(readiness, draft);
  const snapshot = readiness.projectSnapshot,
    prepared = preparedFor(readiness, draft);
  const sheets = readiness.effectiveLayouts.filter(
    (sheet) => sheet.placements.length > 0 && (!options.sheetId || sheet.id === options.sheetId),
  );
  if (!sheets.length) throw new Error('No sheet is available for output.');
  return sheets.map((sheet) => ({
    name: `${safeName(snapshot.metadata.name)}${draft ? '-draft' : ''}-sheet-${String(readiness.effectiveLayouts.indexOf(sheet) + 1).padStart(2, '0')}.svg`,
    mimeType: 'image/svg+xml',
    data: createSheetSvgDocument(snapshot, sheet.id, readiness.effectiveLayouts, prepared),
  }));
}
export function writePreparedPdf(
  readiness: ExportReadiness,
  options: { draft?: boolean } = {},
): PreparedArtifact {
  const draft = options.draft ?? false;
  assertWritable(readiness, draft);
  const snapshot = readiness.projectSnapshot,
    project = draft
      ? {
          ...snapshot,
          metadata: { ...snapshot.metadata, name: `${snapshot.metadata.name} — DRAFT INSPECTION` },
        }
      : snapshot;
  return {
    name: `${safeName(snapshot.metadata.name)}${draft ? '-draft' : ''}-assembly.pdf`,
    mimeType: 'application/pdf',
    data: createAssemblyPdf(project, readiness.effectiveLayouts, preparedFor(readiness, draft)),
  };
}
export async function downloadPreparedArtifacts(
  artifacts: readonly PreparedArtifact[],
): Promise<void> {
  for (let i = 0; i < artifacts.length; i++) {
    const artifact = artifacts[i]!,
      bytes =
        typeof artifact.data === 'string' ? artifact.data : new Uint8Array(artifact.data).buffer,
      blob = new Blob([bytes], { type: artifact.mimeType }),
      url = URL.createObjectURL(blob),
      anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = artifact.name;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (i + 1 < artifacts.length)
      await new Promise<void>((resolve) => window.setTimeout(resolve, 150));
  }
}
