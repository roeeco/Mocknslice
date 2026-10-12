import { describe, expect, it } from 'vitest';
import type { SerializableTriangleMesh } from '../../domain/geometry';
import { papercraftDefaults, type PapercraftKernelInput } from '../../domain/papercraft';
import { hashSerializable } from '../../domain/canonicalHash';
import { createCubeMesh } from '../mesh/createPrimitiveMesh';
import { optimizePapercraft, papercraftInputHash } from './optimizeSeams';
import { preflightPapercraftSource, preparePapercraftSource } from './prepareSource';
import { convexIntersectionArea } from '../designGraph/polygons';
import { EPS_AREA_MM2 } from '../designGraph/tolerances';
import { flattenFaces, distance } from './edgeGeometry';
import { tryForestJoin, uniqueSourceEdges } from './unfoldForest';
import { tracePapercraftPerimeter } from './tracePerimeter';

const inputFor = (mesh: SerializableTriangleMesh): PapercraftKernelInput => ({
  mesh,
  materialThicknessMm: 1,
  settings: papercraftDefaults(hashSerializable(mesh)),
});
function prism(sides: number, apex = false): SerializableTriangleMesh {
  const positionsMm: number[] = [];
  for (let z = 0; z < 2; z++)
    for (let i = 0; i < sides; i++)
      positionsMm.push(
        Math.cos((i * 2 * Math.PI) / sides) * (z && apex ? 0 : 20),
        Math.sin((i * 2 * Math.PI) / sides) * (z && apex ? 0 : 20),
        z * 30,
      );
  if (apex) positionsMm.splice(sides * 3 + 3);
  const indices: number[] = [];
  for (let i = 1; i < sides - 1; i++) indices.push(0, i + 1, i);
  if (!apex) for (let i = 1; i < sides - 1; i++) indices.push(sides, sides + i, sides + i + 1);
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    indices.push(i, j, sides + (apex ? 0 : j));
    if (!apex) indices.push(i, sides + j, sides + i);
  }
  return { positionsMm, indices };
}
describe('papercraft v2 kernel', () => {
  for (const [name, mesh] of [
    ['cube', createCubeMesh(40).mesh],
    ['prism', prism(5)],
    ['pyramid', prism(4, true)],
  ] as const)
    it(`creates repeatable collision-free ${name} forests with preserved lengths`, () => {
      const input = inputFor(mesh),
        result = optimizePapercraft(input);
      expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
      expect(result).toEqual(optimizePapercraft(input));
      expect(result.islands.length).toBeGreaterThan(0);
      expect(result.hingeKeys.length).toBe(result.faces.length - result.islands.length);
      for (const island of result.islands) {
        const faces = result.faces.filter((f) => island.faceIds.includes(f.id));
        expect(tracePapercraftPerimeter(result.source, faces, result.hingeKeys)).toBeDefined();
        for (let i = 0; i < faces.length; i++)
          for (let j = i + 1; j < faces.length; j++)
            expect(convexIntersectionArea(faces[i]!.points, faces[j]!.points)).toBeLessThanOrEqual(
              EPS_AREA_MM2,
            );
      }
      for (const face of result.faces)
        for (let i = 0; i < 3; i++) {
          const j = (i + 1) % 3,
            a = face.vertexIds[i]!,
            b = face.vertexIds[j]!;
          const sourceLength = Math.hypot(
            ...[0, 1, 2].map((k) => mesh.positionsMm[a * 3 + k]! - mesh.positionsMm[b * 3 + k]!),
          );
          expect(distance(face.points[i]!, face.points[j]!)).toBeCloseTo(sourceLength, 8);
        }
      expect(input.mesh).toEqual(mesh);
    });
  it('uses signed winding and validates cube planar patches', () => {
    const source = preparePapercraftSource(inputFor(createCubeMesh(40).mesh));
    expect(source.panels).toHaveLength(6);
    expect(
      source.halfEdges
        .filter((e) => !e.softCoplanar)
        .every((e) => Math.abs(e.signedDihedralDeg! - 90) < 1e-8),
    ).toBe(true);
    expect(source.halfEdges.every((e) => e.oppositeId && e.joinable)).toBe(true);
  });
  it('honors hard cuts and joins and hashes canonical edit order', () => {
    const input = inputFor(createCubeMesh(40).mesh),
      edges = uniqueSourceEdges(preparePapercraftSource(input));
    const tab = { owner: 'none' as const, targetDepthMm: 6, shoulderAngleDeg: 45 };
    input.settings.edgeEdits = [
      { id: edges[0]!.edgeKey, intent: 'must-cut', tab },
      { id: edges[1]!.edgeKey, intent: 'must-join', tab },
    ];
    const result = optimizePapercraft(input);
    expect(result.issues).toEqual([]);
    expect(result.hingeKeys).not.toContain(edges[0]!.edgeKey);
    expect(result.hingeKeys).toContain(edges[1]!.edgeKey);
    expect(papercraftInputHash(input)).toBe(
      papercraftInputHash({
        ...input,
        settings: { ...input.settings, edgeEdits: [...input.settings.edgeEdits].reverse() },
      }),
    );
    input.settings.edgeEdits.push({ id: 'missing', intent: 'must-join', tab });
    expect(optimizePapercraft(input).issues.map((i) => i.code)).toContain(
      'PAPERCRAFT_UNKNOWN_EDGE',
    );
  });
  it('rolls back cycle attempts without mutating any face or hinge', () => {
    const source = preparePapercraftSource(inputFor(createCubeMesh(40).mesh)),
      edge = uniqueSourceEdges(source)[0]!,
      faces = flattenFaces(source),
      snapshot = structuredClone(faces);
    const joined = tryForestJoin(source, faces, [], edge);
    expect(typeof joined).toBe('object');
    if (typeof joined === 'string') throw new Error(joined);
    const before = structuredClone(joined);
    expect(tryForestJoin(source, joined.faces, joined.hinges, edge)).toBe('cycle');
    expect(joined).toEqual(before);
    expect(faces).toEqual(snapshot);
  });
  it('rejects malformed, open, winding, non-manifold, oversized and stale sources with entity IDs', () => {
    const cube = createCubeMesh(40).mesh;
    const open = { ...cube, indices: cube.indices.slice(3) };
    expect(
      preflightPapercraftSource(open).some(
        (i) => i.code === 'PAPERCRAFT_OPEN_EDGE' && i.affectedEntityIds.length > 1,
      ),
    ).toBe(true);
    expect(
      preflightPapercraftSource({ ...cube, positionsMm: [NaN, ...cube.positionsMm.slice(1)] })[0]!
        .code,
    ).toBe('PAPERCRAFT_SOURCE_INVALID');
    expect(
      preflightPapercraftSource({
        ...cube,
        indices: [...cube.indices, ...cube.indices.slice(0, 3)],
      }).some((i) => i.code === 'PAPERCRAFT_NON_MANIFOLD_EDGE'),
    ).toBe(true);
    expect(
      preflightPapercraftSource({
        ...cube,
        indices: [cube.indices[0]!, cube.indices[2]!, cube.indices[1]!, ...cube.indices.slice(3)],
      }).some((i) => i.code === 'PAPERCRAFT_WINDING'),
    ).toBe(true);
    const input = inputFor(cube);
    input.settings.faceTarget = 4;
    expect(optimizePapercraft(input).issues.map((i) => i.code)).toContain('PAPERCRAFT_FACE_LIMIT');
    input.settings.sourceMeshHash = 'stale';
    expect(optimizePapercraft(input).issues.map((i) => i.code)).toContain('PAPERCRAFT_SOURCE_HASH');
  });
  it('supports independent closed bodies and rejects pinched shared vertices', () => {
    const cube = createCubeMesh(20).mesh,
      count = cube.positionsMm.length / 3;
    const second = cube.positionsMm.map((v, i) => (i % 3 === 0 ? v + 40 : v));
    const input = inputFor({
      positionsMm: [...cube.positionsMm, ...second],
      indices: [...cube.indices, ...cube.indices.map((i) => i + count)],
    });
    const result = optimizePapercraft(input);
    expect(result.issues).toEqual([]);
    expect(result.islands.length).toBeGreaterThanOrEqual(2);
    const pinched = {
      positionsMm: [...cube.positionsMm, ...cube.positionsMm.map((v) => v + 20)],
      indices: [...cube.indices, ...cube.indices.map((i) => (i === 0 ? 6 : i + count))],
    };
    expect(preflightPapercraftSource(pinched).map((i) => i.code)).toContain(
      'PAPERCRAFT_PINCHED_VERTEX',
    );
  });
  it('reports progress and budget exhaustion while cancellation produces no partial result', () => {
    const input = inputFor(createCubeMesh(40).mesh),
      stages: string[] = [];
    const result = optimizePapercraft(input, {
      progress: (p) => stages.push(p.stage),
      budgetExpired: () => true,
    });
    expect(result.searchExhausted).toBe(true);
    expect(result.faces).toHaveLength(12);
    expect(stages).toEqual(['prepared', 'candidates', 'completed']);
    let checks = 0;
    expect(() => optimizePapercraft(input, { cancelled: () => ++checks > 2 })).toThrow('cancelled');
  });
});
