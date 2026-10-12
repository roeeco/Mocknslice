import { generateReliableStacked } from './generateReliableStacked';
import type { WaffleSliceInput, WaffleSliceResult } from './types';
import { generateWaffleSlices } from './generateWaffleSlices';
import { integrateWaffleSlotsIntoContours } from './integrateWaffleSlotsIntoContours';
import { canonicalizeContours, outputIssue } from '../output/canonicalizeContours';
import { EPS_LENGTH_MM } from '../designGraph/tolerances';
import type { OpeningSlot, FabricationPart } from '../../domain/fabrication';

const along = (part: FabricationPart, slot: OpeningSlot) => {
  const p = {
    x: (slot.inner[0].x + slot.inner[1].x) / 2,
    y: (slot.inner[0].y + slot.inner[1].y) / 2,
  };
  return part.slice?.axis === 'x'
    ? slot.intersectionAxis === 'y'
      ? p.y
      : p.x
    : part.slice?.axis === 'y'
      ? slot.intersectionAxis === 'x'
        ? p.x
        : p.y
      : slot.intersectionAxis === 'x'
        ? p.x
        : p.y;
};
export function generateReliableWaffle(input: WaffleSliceInput): WaffleSliceResult {
  const count = (axis: 'x' | 'y' | 'z', spacing: number) =>
    (input.bounds.maxMm[{ x: 0, y: 1, z: 2 }[axis]]! -
      input.bounds.minMm[{ x: 0, y: 1, z: 2 }[axis]]!) /
    spacing;
  if (
    ![input.settings.primarySpacingMm, input.settings.secondarySpacingMm].every(
      (n) => Number.isFinite(n) && n > 0,
    ) ||
    count(input.settings.primaryAxis, input.settings.primarySpacingMm) +
      count(input.settings.secondaryAxis, input.settings.secondarySpacingMm) >
      10000
  )
    return {
      parts: [],
      issues: [
        outputIssue(
          'SLICE_COMPLEXITY_LIMIT',
          [],
          'Waffle plane count exceeds the supported bound.',
        ),
      ],
      slotCount: 0,
      primaryPlanePositionsMm: [],
      secondaryPlanePositionsMm: [],
      algorithmVersion: 'closed-waffle-v2',
    };
  const legacy = generateWaffleSlices(input, { sliceGenerator: generateReliableStacked }),
    issues = legacy.issues.map((i) =>
      ['OPEN_SLICE_CONTOUR', 'AMBIGUOUS_SLICE_GRAPH', 'WAFFLE_SLOT_OVERLAP'].includes(i.code)
        ? { ...i, severity: 'error' as const }
        : i,
    );
  const integrated = legacy.parts.map(integrateWaffleSlotsIntoContours);
  issues.push(...integrated.flatMap((p) => p.issues));
  const parts = integrated.map((p) => p.part),
    byId = new Map(parts.map((p) => [p.id, p]));
  for (const part of parts)
    for (const slot of part.waffle?.openingSlots ?? []) {
      const partner = byId.get(slot.pairedPartId),
        mates =
          partner?.waffle?.openingSlots?.filter(
            (s) =>
              s.pairedPartId === part.id &&
              s.intersectionAxis === slot.intersectionAxis &&
              Math.abs(along(part, slot) - along(partner, s)) <= EPS_LENGTH_MM,
          ) ?? [];
      if (
        !partner ||
        mates.length !== 1 ||
        mates[0]!.direction === slot.direction ||
        Math.abs(slot.widthMm - partner.thicknessMm - input.settings.clearanceMm) > EPS_LENGTH_MM
      )
        issues.push(
          outputIssue(
            'WAFFLE_ASSEMBLY_ACCESS_BLOCKED',
            [part.id, slot.pairedPartId, slot.id],
            'Opening slot has no unique accessible complementary partner or matching stock clearance.',
          ),
        );
    }
  const canonical = canonicalizeContours(parts);
  issues.push(...canonical.issues);
  return {
    ...legacy,
    parts: canonical.parts,
    issues: [...new Map(issues.map((i) => [i.id, i])).values()],
    algorithmVersion: 'closed-waffle-v2',
  };
}
