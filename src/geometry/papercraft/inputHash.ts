import type { PapercraftKernelInput } from '../../domain/papercraft';
import { hashSerializable } from '../../domain/canonicalHash';
export function papercraftInputHash(input: PapercraftKernelInput): string {
  return hashSerializable({
    algorithmVersion: 'papercraft-v2',
    ...(input.workingSource ? { workingSource: input.workingSource } : {}),
    mesh: input.mesh,
    materialThicknessMm: input.materialThicknessMm,
    acceptSimplification: input.acceptSimplification ?? false,
    settings: {
      ...input.settings,
      edgeEdits: [...input.settings.edgeEdits].sort((a, b) => a.id.localeCompare(b.id)),
      // Placement and locks are durable layout intent, not geometry inputs.
      islandEdits: [],
    },
  });
}
