import type { SerializableTriangleMesh } from '../domain/geometry';
import { createCubeMesh } from '../geometry/mesh/createPrimitiveMesh';
import { normalizeMesh } from '../geometry/mesh/normalizeMesh';
import {
  createConeSoup,
  createCubeSoup,
  createCylinderSoup,
  createTaperedPrismSoup,
} from './generatedMeshes';

function meshFromSoup(positions: number[]): SerializableTriangleMesh {
  return normalizeMesh({ positions }, { assumedUnit: 'millimetres' }).mesh;
}

function prismSoup(sides: number, radius = 20, height = 40): number[] {
  const positions: number[] = [];
  const ring = (z: number) =>
    Array.from({ length: sides }, (_, index) => {
      const angle = (index * Math.PI * 2) / sides;
      return [Math.cos(angle) * radius, Math.sin(angle) * radius, z];
    });
  const bottom = ring(-height / 2);
  const top = ring(height / 2);
  for (let index = 0; index < sides; index += 1) {
    const next = (index + 1) % sides;
    positions.push(...bottom[index]!, ...bottom[next]!, ...top[next]!);
    positions.push(...bottom[index]!, ...top[next]!, ...top[index]!);
    positions.push(0, 0, -height / 2, ...bottom[next]!, ...bottom[index]!);
    positions.push(0, 0, height / 2, ...top[index]!, ...top[next]!);
  }
  return positions;
}

function createRevolvedPatch(
  radiusAtHeight: (heightRatio: number) => number,
  height = 60,
  arcSegments = 12,
  heightSegments = 4,
): SerializableTriangleMesh {
  const positionsMm: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= heightSegments; row += 1) {
    const heightRatio = row / heightSegments;
    const radius = radiusAtHeight(heightRatio);
    const z = (heightRatio - 0.5) * height;
    for (let column = 0; column <= arcSegments; column += 1) {
      const angle = -Math.PI / 2 + (column / arcSegments) * Math.PI;
      positionsMm.push(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
    }
  }
  const rowLength = arcSegments + 1;
  for (let row = 0; row < heightSegments; row += 1) {
    for (let column = 0; column < arcSegments; column += 1) {
      const bottomLeft = row * rowLength + column;
      const bottomRight = bottomLeft + 1;
      const topLeft = bottomLeft + rowLength;
      const topRight = topLeft + 1;
      indices.push(bottomLeft, bottomRight, topRight, bottomLeft, topRight, topLeft);
    }
  }
  return { positionsMm, indices };
}

function createHeightFieldPatch(
  heightAt: (x: number, y: number) => number,
  size = 40,
  segments = 8,
): SerializableTriangleMesh {
  const positionsMm: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= segments; row += 1) {
    const y = (row / segments - 0.5) * size;
    for (let column = 0; column <= segments; column += 1) {
      const x = (column / segments - 0.5) * size;
      positionsMm.push(x, y, heightAt(x, y));
    }
  }
  const rowLength = segments + 1;
  for (let row = 0; row < segments; row += 1) {
    for (let column = 0; column < segments; column += 1) {
      const bottomLeft = row * rowLength + column;
      const bottomRight = bottomLeft + 1;
      const topLeft = bottomLeft + rowLength;
      const topRight = topLeft + 1;
      indices.push(bottomLeft, bottomRight, topRight, bottomLeft, topRight, topLeft);
    }
  }
  return { positionsMm, indices };
}

/** Canonical meshes for geometry assertions.  All dimensions are millimetres. */
export const fabricationMeshes = {
  triangulatedCube: createCubeMesh(40).mesh,
  rectangularPrism: meshFromSoup(createTaperedPrismSoup(60, 40, 1, 30).positions),
  triangularPrism: meshFromSoup(prismSoup(3)),
  sixSidedPrism: meshFromSoup(prismSoup(6)),
  noisyCoplanarCube: meshFromSoup(createCubeSoup(40).positions),
  cylinder: meshFromSoup(createCylinderSoup(20, 40, 24).positions),
  cone: meshFromSoup(createConeSoup(20, 40, 24).positions),
  cylindricalPatch: createRevolvedPatch(() => 20),
  conicalPatch: createRevolvedPatch((heightRatio) => 20 - heightRatio * 10),
  sphericalPatch: createHeightFieldPatch((x, y) => {
    const radius = 45;
    return radius - Math.sqrt(radius * radius - x * x - y * y);
  }),
  saddlePatch: createHeightFieldPatch((x, y) => (x * x - y * y) / 60),
  symmetricModel: createCubeMesh(40).mesh,
} as const;
