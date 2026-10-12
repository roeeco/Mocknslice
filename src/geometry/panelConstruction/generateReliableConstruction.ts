import { jointSpecs } from './dividerJoints';
import type { PanelConnectionOverrides, PanelRole } from '../../domain/panelConstruction';
import {
  generatePanelConstruction,
  type PanelConstructionInput,
} from './generatePanelConstruction';
import { hashSerializable } from '../../domain/canonicalHash';
import { canonicalizeContours } from '../output/canonicalizeContours';
export function generateReliableConstruction(input: PanelConstructionInput) {
  const role = (role: PanelRole): 'panel' | 'divider' | 'lid' =>
    role === 'lid' ? 'lid' : role.startsWith('divider-') ? 'divider' : 'panel';
  const overrides: PanelConnectionOverrides = { ...input.settings.connectionOverrides };
  for (const spec of jointSpecs(input.settings))
    if (spec.connectionKey) {
      const original = overrides[spec.connectionKey],
        clearance = Math.max(
          input.settings.roleClearanceMm?.[role(spec.panelA)] ?? input.settings.clearanceMm,
          input.settings.roleClearanceMm?.[role(spec.panelB)] ?? input.settings.clearanceMm,
        );
      const treatment =
        original?.treatment ?? (input.settings.jointKind === 'butt' ? 'butt' : 'finger');
      overrides[spec.connectionKey] = {
        treatment,
        ...original,
        ...(treatment === 'finger' ? { clearanceMm: original?.clearanceMm ?? clearance } : {}),
      };
    }
  const proxy = {
    ...input,
    settings: {
      ...input.settings,
      clearanceMm: Math.max(
        input.settings.roleClearanceMm?.divider ?? input.settings.clearanceMm,
        input.settings.roleClearanceMm?.panel ?? input.settings.clearanceMm,
      ),
      connectionOverrides: overrides,
    },
  };
  const result = generatePanelConstruction(proxy, { validateReciprocal: true }),
    canonical = canonicalizeContours(result.parts);
  for (const part of canonical.parts) {
    const panel = result.panels.find((p) => p.partId === part.id)!,
      kind = role(panel.role);
    part.stock = {
      id: `${input.material.id}:${part.thicknessMm}`,
      kerfMm: input.settings.roleKerfMm?.[kind] ?? input.material.kerfMm,
      clearanceMm: input.settings.roleClearanceMm?.[kind] ?? input.settings.clearanceMm,
    };
  }
  return {
    ...result,
    settings: input.settings,
    parts: canonical.parts,
    issues: [...result.issues, ...canonical.issues],
    algorithmVersion: 'reciprocal-panels-v2',
    inputHash: hashSerializable({
      algorithmVersion: 'reciprocal-panels-v2',
      sourceId: input.sourceId ?? input.modelId ?? 'panel-construction',
      material: input.material,
      settings: input.settings,
    }),
  };
}
