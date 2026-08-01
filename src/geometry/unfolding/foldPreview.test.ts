import { describe, expect, it } from 'vitest';
import type { Vector3Mm } from '../../domain/geometry';
import type { MeshUnfoldSettings } from '../../domain/unfolding';
import { createCubeMesh } from '../mesh/createPrimitiveMesh';
import { generateMeshUnfold } from './generateMeshUnfold';
import { unfoldedFaceVerticesAtProgress } from './foldPreview';

const settings: MeshUnfoldSettings = {
  strategy: 'automatic',
  rootFaceIndex: 0,
  manualSeamKeys: [],
  tabDepthMm: 6,
  maximumFaceCount: 200,
  searchAttempts: 18,
};

function distance(first: Vector3Mm, second: Vector3Mm): number {
  return Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2]);
}

describe('unfoldedFaceVerticesAtProgress', () => {
  it.each([0, 0.5, 1])('keeps rigid triangles and connected hinge endpoints at %s', (progress) => {
    const cube = createCubeMesh(40);
    const result = generateMeshUnfold({
      mesh: cube.mesh,
      modelId: 'cube',
      materialThicknessMm: 1,
      settings,
    });
    const positions = unfoldedFaceVerticesAtProgress(result, progress);

    for (const face of result.faces) {
      const current = positions.get(face.id)!;
      expect(distance(current[0], current[1])).toBeCloseTo(
        distance(face.sourceVerticesMm[0], face.sourceVerticesMm[1]),
        5,
      );
      expect(distance(current[1], current[2])).toBeCloseTo(
        distance(face.sourceVerticesMm[1], face.sourceVerticesMm[2]),
        5,
      );
      expect(distance(current[2], current[0])).toBeCloseTo(
        distance(face.sourceVerticesMm[2], face.sourceVerticesMm[0]),
        5,
      );
    }

    for (const hinge of result.hinges) {
      const parent = result.faces.find((face) => face.id === hinge.parentFaceId)!;
      const child = result.faces.find((face) => face.id === hinge.childFaceId)!;
      const parentPositions = positions.get(parent.id)!;
      const childPositions = positions.get(child.id)!;
      for (const vertex of [hinge.vertexA, hinge.vertexB]) {
        const parentPoint = parentPositions[parent.sourceVertexIndices.indexOf(vertex)]!;
        const childPoint = childPositions[child.sourceVertexIndices.indexOf(vertex)]!;
        expect(distance(parentPoint, childPoint)).toBeLessThan(1e-5);
      }
    }
  });

  it('clamps preview progress to the flat and folded endpoints', () => {
    const cube = createCubeMesh(40);
    const result = generateMeshUnfold({
      mesh: cube.mesh,
      modelId: 'cube',
      materialThicknessMm: 1,
      settings,
    });

    expect(unfoldedFaceVerticesAtProgress(result, -1)).toEqual(
      unfoldedFaceVerticesAtProgress(result, 0),
    );
    expect(unfoldedFaceVerticesAtProgress(result, 2)).toEqual(
      unfoldedFaceVerticesAtProgress(result, 1),
    );
  });

  it('rejoins every source vertex when the fold tree reaches 100%', () => {
    const cube = createCubeMesh(40);
    const result = generateMeshUnfold({
      mesh: cube.mesh,
      modelId: 'cube',
      materialThicknessMm: 1,
      settings,
    });
    const positions = unfoldedFaceVerticesAtProgress(result, 1);
    const pointsBySourceVertex = new Map<number, Vector3Mm[]>();
    for (const face of result.faces) {
      const facePositions = positions.get(face.id)!;
      face.sourceVertexIndices.forEach((sourceVertex, localIndex) => {
        const points = pointsBySourceVertex.get(sourceVertex) ?? [];
        points.push(facePositions[localIndex]!);
        pointsBySourceVertex.set(sourceVertex, points);
      });
    }
    for (const points of pointsBySourceVertex.values()) {
      for (const point of points.slice(1)) expect(distance(points[0]!, point)).toBeLessThan(1e-4);
    }
  });
});
