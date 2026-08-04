import type { FabricationMode } from './fabrication';
import type { SerializableTriangleMesh } from './geometry';
import type { ProjectData } from './project';

export interface GenerationRecord {
  mode: FabricationMode;
  sourceModelId: string;
  sourceMeshHash: string;
  settingsHash: string;
  materialHash: string;
  resultHash: string;
  algorithmVersion: string;
  generatedAt: string;
}

export type GenerationState = 'absent' | 'ready' | 'stale' | 'invalid' | 'legacy-unverified';
export type GenerationBlockingReason =
  'GENERATION_ABSENT' | 'GENERATION_STALE' | 'GENERATION_INVALID' | 'GENERATION_UNVERIFIED';

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`)
    .join(',')}}`;
}

export function hashSerializable(value: unknown): string {
  let hash = 2166136261;
  for (const character of stable(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `sf9-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function hashSerializableMesh(mesh: SerializableTriangleMesh | undefined): string {
  return hashSerializable(mesh ?? null);
}

export function expectedGenerationSignature(project: ProjectData) {
  return {
    mode: project.fabricationMode,
    sourceModelId: project.model.id,
    sourceMeshHash: hashSerializableMesh(project.model.mesh),
    settingsHash: hashSerializable(project.modeParameters),
    materialHash: hashSerializable(project.materialProfileSnapshot),
  };
}

export function deriveGenerationState(project: ProjectData): GenerationState {
  if (project.generatedParts.length === 0) return 'absent';
  const record = project.generationRecord;
  if (!record) return 'legacy-unverified';
  const expected = expectedGenerationSignature(project);
  if (
    record.mode !== expected.mode ||
    record.sourceModelId !== expected.sourceModelId ||
    record.sourceMeshHash !== expected.sourceMeshHash ||
    record.settingsHash !== expected.settingsHash ||
    record.materialHash !== expected.materialHash
  )
    return 'stale';
  return project.generationIssues?.some((issue) => issue.severity === 'error')
    ? 'invalid'
    : 'ready';
}

export function generationBlockingReasons(project: ProjectData): GenerationBlockingReason[] {
  switch (deriveGenerationState(project)) {
    case 'absent':
      return ['GENERATION_ABSENT'];
    case 'stale':
      return ['GENERATION_STALE'];
    case 'invalid':
      return ['GENERATION_INVALID'];
    case 'legacy-unverified':
      return ['GENERATION_UNVERIFIED'];
    default:
      return [];
  }
}
