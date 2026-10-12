import { subdividedCube } from '../../test-fixtures/papercraftSources';
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { SerializableTriangleMesh } from '../../domain/geometry';
import { createCubeMesh } from '../mesh/createPrimitiveMesh';
import { papercraftDefaults } from '../../domain/papercraft';
import { hashSerializable } from '../../domain/canonicalHash';
import { generatePapercraft } from './buildFabrication';
import { papercraftFaceVerticesAtProgress } from './foldPreview';
import { relinkOnModelUpdate } from './relinkOnModelUpdate';
import { papercraftHalfEdges } from './halfEdge';
import { preparePapercraftSource } from './prepareSource';
import { acceptedWorkingSource } from './workingSource';
import { verifySurfaceDeviation } from './measureSurfaceDeviation';
import { optimizePapercraft } from './optimizeSeams';
const cube = createCubeMesh(40).mesh;
const inputFor = (mesh: SerializableTriangleMesh) => ({
  mesh,
  materialThicknessMm: 0.35,
  settings: { ...papercraftDefaults(hashSerializable(mesh)), maxCandidates: 1 },
});
describe('source update, accepted preparation and rigid root reliability', () => {
  it('retains exact edits, flips ownership under face reordering, and gates unmatched changes', () => {
    const result = generatePapercraft(inputFor(cube)),
      topology = papercraftHalfEdges(cube);
    const edge = topology.halfEdges.find(
      (e) =>
        e.faceId === 'face-0' &&
        topology.halfEdges.find((other) => other.id === e.oppositeId)?.faceId === 'face-1',
    )!;
    const settings = {
      ...inputFor(cube).settings,
      edgeEdits: [
        {
          id: edge.edgeKey,
          intent: 'must-cut' as const,
          tab: { owner: 'face-a' as const, targetDepthMm: 6, shoulderAngleDeg: 45 },
        },
      ],
      islandEdits: [
        {
          id: result.islands[0]!.id,
          rootFaceId: result.islands[0]!.rootFaceId,
          translationMm: [35, 50] as [number, number],
          rotationDeg: 37,
          layoutLocked: true,
          sourceFaceIds: result.islands[0]!.faceIds,
        },
      ],
    };
    expect(relinkOnModelUpdate(cube, cube, settings, result).edgeEdits).toEqual(settings.edgeEdits);
    const reordered = { ...cube, indices: [...cube.indices.slice(3), ...cube.indices.slice(0, 3)] };
    const relinked = relinkOnModelUpdate(cube, reordered, settings, result);
    expect(relinked.unresolvedEdits).toEqual([]);
    expect(relinked.edgeEdits[0]!.tab.owner).toBe('face-b');
    expect(relinked.islandEdits[0]!.rotationDeg).toBe(37);
    expect(relinked.islandEdits[0]!.sourceFaceIds).toHaveLength(12);
    const translated = {
      ...cube,
      positionsMm: cube.positionsMm.map((v, i) => v + (i % 3 === 0 ? 0.02 : 0)),
    };
    expect(
      relinkOnModelUpdate(cube, translated, settings, result).edgeMatches[0]!.confidence,
    ).toBeCloseTo(0.8);
    const changed = { ...cube, positionsMm: cube.positionsMm.map((v) => v * 1.2) },
      failed = relinkOnModelUpdate(cube, changed, settings, result);
    expect(failed.edgeEdits).toEqual([]);
    expect(failed.unresolvedEdits).toHaveLength(2);
    expect(failed.unresolvedEdits[0]!.edit).toEqual(settings.edgeEdits[0]);
    const ambiguous = {
      positionsMm: [...cube.positionsMm, ...cube.positionsMm],
      indices: [...cube.indices, ...cube.indices.map((i) => i + 8)],
    };
    expect(relinkOnModelUpdate(cube, ambiguous, settings, result).edgeMatches).toEqual([]);
  });
  it('folds separate bodies into their original source orientation and spacing at every source vertex', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -Math.PI, max: Math.PI, noNaN: true }),
        fc.integer({ min: 80, max: 180 }),
        (angle, offset) => {
          const mesh = {
            positionsMm: [
              ...cube.positionsMm,
              ...cube.positionsMm.map((v, i) => v + (i % 3 === 0 ? offset : 0)),
            ],
            indices: [...cube.indices, ...cube.indices.map((i) => i + 8)],
          };
          for (let i = 0; i < mesh.positionsMm.length; i += 3) {
            const x = mesh.positionsMm[i]!,
              y = mesh.positionsMm[i + 1]!;
            mesh.positionsMm[i] = x * Math.cos(angle) - y * Math.sin(angle);
            mesh.positionsMm[i + 1] = x * Math.sin(angle) + y * Math.cos(angle);
          }
          const result = generatePapercraft(inputFor(mesh)),
            full = papercraftFaceVerticesAtProgress(result, 1);
          const centre = [0, 1, 2].map((axis) => {
            const values = mesh.positionsMm.filter((_, i) => i % 3 === axis);
            return (Math.min(...values) + Math.max(...values)) / 2;
          });
          expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
          for (const face of result.faces)
            for (let j = 0; j < 3; j++) {
              const expected = mesh.positionsMm
                .slice(face.vertexIds[j]! * 3, face.vertexIds[j]! * 3 + 3)
                .map((v, i) => v - centre[i]!);
              expect(
                Math.hypot(...expected.map((v, i) => v - full.get(face.id)![j]![i]!)),
              ).toBeLessThan(0.05);
            }
          for (const p of [0, 0.25, 0.5, 0.75, 1]) {
            const positions = papercraftFaceVerticesAtProgress(result, p);
            for (const face of result.faces)
              for (let i = 0; i < 3; i++) {
                const a = positions.get(face.id)![i]!,
                  b = positions.get(face.id)![(i + 1) % 3]!,
                  flatA = face.points[i]!,
                  flatB = face.points[(i + 1) % 3]!;
                expect(Math.hypot(...a.map((v, j) => v - b[j]!))).toBeCloseTo(
                  Math.hypot(flatA.x - flatB.x, flatA.y - flatB.y),
                  6,
                );
              }
          }
          const flat = papercraftFaceVerticesAtProgress(result, 0),
            bounds = result.islands.map((island) => {
              const points = island.faceIds.flatMap((id) => flat.get(id)!);
              return [Math.min(...points.map((p) => p[0])), Math.max(...points.map((p) => p[0]))];
            });
          expect(bounds[1]![0]! - bounds[0]![1]!).toBeCloseTo(10, 6);
        },
      ),
      { numRuns: 12 },
    );
  });
  it('preserves an accepted simplified mesh identity during tab edits and rejects forged preparation', () => {
    const mesh = subdividedCube(),
      input = {
        ...inputFor(mesh),
        acceptSimplification: true,
        settings: { ...inputFor(mesh).settings, faceTarget: 150, maximumDeviationMm: 0.5 },
      };
    const source = preparePapercraftSource(input);
    expect(source.issues).toEqual([]);
    expect(source.metrics).toMatchObject({
      beforeFaceCount: 192,
      afterFaceCount: 150,
      simplified: true,
      maximumDeviationMm: 0,
    });
    const initial = generatePapercraft(input),
      workingSource = acceptedWorkingSource(input, initial)!;
    const edited = {
      ...input,
      workingSource,
      settings: {
        ...input.settings,
        edgeEdits: initial.tabs
          .filter((t) => t.status === 'unresolved')
          .map((t) => ({
            id: t.edgeKey,
            intent: 'auto' as const,
            tab: { owner: 'none' as const, targetDepthMm: 6, shoulderAngleDeg: 45 },
          })),
      },
    };
    const result = generatePapercraft(edited);
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(result.hingeKeys).toEqual(initial.hingeKeys);
    expect(result.source.mesh).toEqual(source.mesh);
    expect(result.parts.length).toBeGreaterThan(0);
    const forged = structuredClone(edited);
    forged.workingSource.mesh.positionsMm[0]! += 5;
    forged.workingSource.meshHash = hashSerializable(forged.workingSource.mesh);
    expect(
      preparePapercraftSource(forged).issues.some(
        (i) => i.code === 'PAPERCRAFT_WORKING_SOURCE_INVALID',
      ),
    ).toBe(true);
    const changed = { ...edited, settings: { ...edited.settings, faceTarget: 149 } };
    expect(
      preparePapercraftSource(changed).issues.some(
        (i) => i.code === 'PAPERCRAFT_WORKING_SOURCE_INVALID',
      ),
    ).toBe(true);
  });
  it('uses a continuous bidirectional surface bound and fails closed on a verification budget', () => {
    expect(verifySurfaceDeviation(cube, cube, 0).verified).toBe(true);
    const smaller = { ...cube, positionsMm: cube.positionsMm.map((v) => v * 0.5) };
    expect(verifySurfaceDeviation(cube, smaller, 0.5).verified).toBe(false);
    expect(verifySurfaceDeviation(cube, smaller, 100).verified).toBe(true);
    expect(verifySurfaceDeviation(cube, smaller, 100, 0).verified).toBe(false);
    const outer: SerializableTriangleMesh = {
      positionsMm: [0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0],
      indices: [0, 1, 2, 0, 2, 3],
    };
    const gap = {
      positionsMm: [
        ...outer.positionsMm,
        1.999975,
        1.999975,
        0,
        2.000025,
        1.999975,
        0,
        2.000025,
        2.000025,
        0,
        1.999975,
        2.000025,
        0,
      ],
      indices: [0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7],
    };
    expect(verifySurfaceDeviation(outer, gap, 0).verified).toBe(false);
  });
  it('stops optional search while preserving mandatory joins and cuts', () => {
    const settings = inputFor(cube).settings,
      edges = papercraftHalfEdges(cube).halfEdges;
    settings.edgeEdits = [
      {
        id: edges[0]!.edgeKey,
        intent: 'must-join',
        tab: { owner: 'none', targetDepthMm: 6, shoulderAngleDeg: 45 },
      },
      {
        id: edges.find((e) => e.edgeKey !== edges[0]!.edgeKey)!.edgeKey,
        intent: 'must-cut',
        tab: { owner: 'none', targetDepthMm: 6, shoulderAngleDeg: 45 },
      },
    ];
    settings.maxCandidates = 32;
    const result = optimizePapercraft(
      { ...inputFor(cube), settings },
      { budgetExpired: () => true },
    );
    expect(result.hingeKeys).toContain(settings.edgeEdits[0]!.id);
    expect(result.hingeKeys).not.toContain(settings.edgeEdits[1]!.id);
    expect(result.searchExhausted).toBe(true);
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
  });
});
