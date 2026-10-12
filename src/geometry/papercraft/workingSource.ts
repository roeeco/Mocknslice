import type {
  PapercraftKernelInput,
  PapercraftResult,
  PapercraftWorkingSource,
} from '../../domain/papercraft';
import { hashSerializable } from '../../domain/canonicalHash';
export function papercraftPreparationHash(input: Pick<PapercraftKernelInput, 'mesh' | 'settings'>) {
  return hashSerializable({
    algorithm: 'verified-preparation-v1',
    meshHash: hashSerializable(input.mesh),
    faceTarget: input.settings.faceTarget,
    maximumDeviationMm: input.settings.maximumDeviationMm,
  });
}
export function acceptedWorkingSource(
  input: PapercraftKernelInput,
  result: Pick<PapercraftResult, 'source'>,
): PapercraftWorkingSource | undefined {
  if (!result.source.metrics.simplified) return;
  return {
    mesh: structuredClone(result.source.mesh),
    meshHash: hashSerializable(result.source.mesh),
    preparationHash: papercraftPreparationHash(input),
    maximumDeviationMm: result.source.metrics.maximumDeviationMm,
  };
}
