import type { FabricationMode } from './fabrication';
import type { SerializableTriangleMesh } from './geometry';
import type { LegacyProjectData, ProjectData } from './project';
import { hashSerializable } from './canonicalHash';
import { canonicalGenerationSignature } from './generationInputs';

export interface LegacyGenerationRecord {
  mode: FabricationMode;
  sourceModelId: string;
  sourceMeshHash: string;
  settingsHash: string;
  materialHash: string;
  resultHash: string;
  algorithmVersion: string;
  generatedAt: string;
}

export interface CanonicalGenerationRecord {
  signatureVersion: 2 | 3;
  mode: FabricationMode;
  inputHash: string;
  resultHash: string;
  algorithmVersion: string;
  generatedAt: string;
}

export type GenerationRecord = LegacyGenerationRecord | CanonicalGenerationRecord;

export type GenerationState = 'absent' | 'ready' | 'stale' | 'invalid' | 'legacy-unverified';
export type GenerationBlockingReason =
  'GENERATION_ABSENT' | 'GENERATION_STALE' | 'GENERATION_INVALID' | 'GENERATION_UNVERIFIED';

export { hashSerializable } from './canonicalHash';

export function hashSerializableMesh(mesh: SerializableTriangleMesh | undefined): string {
  return hashSerializable(mesh ?? null);
}

export function legacyGenerationSignature(project: LegacyProjectData) {
  return {
    mode: project.fabricationMode,
    sourceModelId: project.model.id,
    sourceMeshHash: hashSerializableMesh(project.model.mesh),
    settingsHash: hashSerializable(project.modeParameters),
    materialHash: hashSerializable(project.materialProfileSnapshot),
  };
}

export function expectedGenerationSignature(project: ProjectData) {
  return canonicalGenerationSignature(project);
}

export function upgradeLegacyGenerationRecord(
  legacyProject: LegacyProjectData,
  project: ProjectData,
): ProjectData {
  const record = legacyProject.generationRecord;
  if (!record) return project;
  if ('signatureVersion' in record) return { ...project, generationRecord: record };
  const legacy = legacyGenerationSignature(legacyProject);
  if (
    record.mode !== legacy.mode ||
    record.sourceModelId !== legacy.sourceModelId ||
    record.sourceMeshHash !== legacy.sourceMeshHash ||
    record.settingsHash !== legacy.settingsHash ||
    record.materialHash !== legacy.materialHash
  ) {
    const unverified: ProjectData = { ...project };
    delete unverified.generationRecord;
    return unverified;
  }
  try {
    return {
      ...project,
      generationRecord: {
        ...canonicalGenerationSignature(project),
        resultHash: record.resultHash,
        algorithmVersion: record.algorithmVersion,
        generatedAt: record.generatedAt,
      },
    };
  } catch {
    const unverified: ProjectData = { ...project };
    delete unverified.generationRecord;
    return unverified;
  }
}

export function deriveGenerationState(project: ProjectData): GenerationState {
  if (project.generatedParts.length === 0) return 'absent';
  const record = project.generationRecord;
  if (!record) return 'legacy-unverified';
  if (!('signatureVersion' in record)) return 'legacy-unverified';
  let expected: ReturnType<typeof canonicalGenerationSignature>;
  try {
    expected = canonicalGenerationSignature(project);
  } catch {
    return 'invalid';
  }
  if (record.mode !== expected.mode || record.inputHash !== expected.inputHash) return 'stale';
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
