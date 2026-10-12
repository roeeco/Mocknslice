import { describe, expect, it } from 'vitest';
import { createProject } from '../../app/createProject';
import { createCubeMesh } from '../mesh/createPrimitiveMesh';
import { triangulatePolygon, isSimplePolygon, signedArea } from '../designGraph/polygons';
import type { SerializableTriangleMesh, Bounds3D } from '../../domain/geometry';
import { generateReliableStacked } from './generateReliableStacked';
import { generateReliableWaffle } from './generateReliableWaffle';
import { prepareFabricationOutput } from '../output/prepareFabricationOutput';
import { canonicalizeContours } from '../output/canonicalizeContours';
import { normalizeMesh } from '../mesh/normalizeMesh';
import { createOpenCubeSoup } from '../../test-fixtures/generatedMeshes';

const defaults = createProject().modeSettings;
function bounds(mesh: SerializableTriangleMesh): Bounds3D {
  return {
    minMm: [0, 1, 2].map((k) =>
      Math.min(...mesh.positionsMm.filter((_, i) => i % 3 === k)),
    ) as Bounds3D['minMm'],
    maxMm: [0, 1, 2].map((k) =>
      Math.max(...mesh.positionsMm.filter((_, i) => i % 3 === k)),
    ) as Bounds3D['maxMm'],
  };
}
const cube = createCubeMesh(48).mesh,
  prism = { ...cube, positionsMm: cube.positionsMm.map((v, i) => v * [2, 1, 4 / 3][i % 3]!) };
function extrudedL() {
  const polygon = [
      { x: -48, y: -24 },
      { x: 48, y: -24 },
      { x: 48, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 24 },
      { x: -48, y: 24 },
    ],
    positionsMm = [-32, 32].flatMap((z) => polygon.flatMap((p) => [p.x, p.y, z])),
    indices: number[] = [];
  for (const triangle of triangulatePolygon(polygon)) {
    const ids = triangle.map((p) => polygon.findIndex((v) => v.x === p.x && v.y === p.y));
    indices.push(...[...ids].reverse(), ...ids.map((i) => i + polygon.length));
  }
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    indices.push(i, j, j + polygon.length, i, j + polygon.length, i + polygon.length);
  }
  return { positionsMm, indices };
}
function torus() {
  const positionsMm: number[] = [],
    indices: number[] = [],
    major = 16,
    minor = 8;
  for (let i = 0; i < major; i++)
    for (let j = 0; j < minor; j++) {
      const a = (i * 2 * Math.PI) / major,
        b = (j * 2 * Math.PI) / minor,
        r = 30 + 8 * Math.cos(b);
      positionsMm.push(r * Math.cos(a), r * Math.sin(a), 8 * Math.sin(b));
    }
  for (let i = 0; i < major; i++)
    for (let j = 0; j < minor; j++) {
      const a = i * minor + j,
        b = ((i + 1) % major) * minor + j,
        c = ((i + 1) % major) * minor + ((j + 1) % minor),
        d = i * minor + ((j + 1) % minor);
      indices.push(a, b, c, a, c, d);
    }
  return { positionsMm, indices };
}
describe('reliable slice and waffle engines', () => {
  for (const [name, mesh] of [
    ['cube', cube],
    ['prism', prism],
    ['concave-L', extrudedL()],
  ] as const)
    for (const thicknessMm of [1, 3])
      it(`${name} at ${thicknessMm} mm produces closed reciprocal fabrication with two kerfs`, () => {
        const input = { mesh, bounds: bounds(mesh), modelId: name },
          stacked = generateReliableStacked({
            ...input,
            settings: { ...defaults.stackedSlices, axis: 'z', spacingMm: 16, thicknessMm },
          }),
          waffle = generateReliableWaffle({
            ...input,
            settings: {
              ...defaults.waffleSlices,
              primaryAxis: 'x',
              secondaryAxis: 'y',
              primarySpacingMm: 16,
              secondarySpacingMm: 16,
              thicknessMm,
              clearanceMm: 0.2,
            },
          });
        expect(stacked.issues.filter((i) => i.severity === 'error')).toEqual([]);
        expect(waffle.issues.filter((i) => i.severity === 'error')).toEqual([]);
        expect(
          waffle.parts.every((p) =>
            p.paths
              .filter((path) => path.operation === 'cut')
              .every((path) => path.closed && isSimplePolygon(path.points)),
          ),
        ).toBe(true);
        expect(
          waffle.parts.flatMap((p) => p.paths).filter((p) => p.operation === 'cut' && p.slot),
        ).toEqual([]);
        for (const part of waffle.parts)
          for (const slot of part.waffle!.openingSlots ?? []) {
            const partner = waffle.parts.find((p) => p.id === slot.pairedPartId)!;
            expect(partner).toBeDefined();
            expect(
              partner.waffle!.openingSlots!.some(
                (s) => s.pairedPartId === part.id && s.direction !== slot.direction,
              ),
            ).toBe(true);
          }
        for (const kerf of [0, 0.12]) {
          const project = createProject();
          project.generatedParts = waffle.parts;
          project.exportSettings.kerfCompensation = 'custom';
          project.exportSettings.customKerfMm = kerf;
          const prepared = prepareFabricationOutput(project);
          expect(prepared.issues.filter((i) => i.severity === 'error')).toEqual([]);
          expect(canonicalizeContours(prepared.parts).issues).toEqual([]);
        }
        expect(waffle).toEqual(
          generateReliableWaffle({
            ...input,
            settings: {
              ...defaults.waffleSlices,
              primaryAxis: 'x',
              secondaryAxis: 'y',
              primarySpacingMm: 16,
              secondarySpacingMm: 16,
              thicknessMm,
              clearanceMm: 0.2,
            },
          }),
        );
      });
  it('preserves torus inner holes and validates explicit registration ligaments', () => {
    const mesh = torus(),
      input = {
        mesh,
        bounds: bounds(mesh),
        modelId: 'torus',
        settings: { ...defaults.stackedSlices, axis: 'z' as const, spacingMm: 32, thicknessMm: 1 },
      },
      plain = generateReliableStacked(input);
    expect(plain.parts).toHaveLength(1);
    expect(plain.parts[0]!.paths.filter((p) => p.contourRole === 'hole')).toHaveLength(1);
    const aligned = generateReliableStacked({
      ...input,
      settings: {
        ...input.settings,
        registrationHoles: {
          id: 'alignment',
          centres: [
            { x: 0.15, y: 0.5 },
            { x: 0.85, y: 0.5 },
          ],
          diameterMm: 2,
        },
      },
    });
    expect(aligned.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(aligned.parts[0]!.paths.filter((p) => p.contourRole === 'hole')).toHaveLength(3);
    expect(
      aligned.parts[0]!.paths.filter((p) => p.contourRole === 'hole').every(
        (p) => signedArea(p.points) < 0,
      ),
    ).toBe(true);
    const invalid = generateReliableStacked({
      ...input,
      settings: {
        ...input.settings,
        registrationHoles: {
          id: 'bad',
          centres: [
            { x: 0.5, y: 0.5 },
            { x: 0.6, y: 0.5 },
          ],
          diameterMm: 2,
        },
      },
    });
    expect(invalid.issues.map((i) => i.code)).toContain('REGISTRATION_HOLE_OUTSIDE_PART');
  });
  it('respects first layer offset and blocks branch/open contour and complexity failures', () => {
    const input = {
      mesh: cube,
      bounds: bounds(cube),
      modelId: 'cube',
      settings: {
        ...defaults.stackedSlices,
        axis: 'z' as const,
        spacingMm: 16,
        thicknessMm: 1,
        firstLayerOffsetMm: 4,
      },
    };
    expect(generateReliableStacked(input).planePositionsMm[0]).toBe(-20);
    expect(
      generateReliableStacked({
        ...input,
        settings: { ...input.settings, spacingMm: 1e-9 },
      }).issues.map((i) => i.code),
    ).toContain('SLICE_COMPLEXITY_LIMIT');
    const open = normalizeMesh(createOpenCubeSoup(), { assumedUnit: 'millimetres' });
    const result = generateReliableStacked({
      mesh: open.mesh,
      bounds: open.bounds,
      modelId: 'open',
      settings: { ...defaults.stackedSlices, axis: 'x', spacingMm: 8, thicknessMm: 1 },
    });
    expect(result.issues.some((i) => i.severity === 'error')).toBe(true);
  });
});
