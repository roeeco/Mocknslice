import type { TriangleSoup } from '../geometry/mesh/normalizeMesh';

type Vertex = [number, number, number];

function soupFromIndexed(vertices: Vertex[], indices: number[]): TriangleSoup {
  const positions: number[] = [];
  for (const index of indices) {
    const vertex = vertices[index];
    if (!vertex) throw new Error('Fixture index is outside the vertex array.');
    positions.push(...vertex);
  }
  return { positions };
}

export function createCubeSoup(size = 40, offset: Vertex = [0, 0, 0]): TriangleSoup {
  const half = size / 2;
  const baseVertices: Vertex[] = [
    [-half, -half, -half],
    [half, -half, -half],
    [half, half, -half],
    [-half, half, -half],
    [-half, -half, half],
    [half, -half, half],
    [half, half, half],
    [-half, half, half],
  ];
  const vertices: Vertex[] = baseVertices.map(([x, y, z]) => [
    x + offset[0],
    y + offset[1],
    z + offset[2],
  ]);
  return soupFromIndexed(
    vertices,
    [
      0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5, 0, 1, 5, 0, 5, 4, 3,
      7, 6, 3, 6, 2,
    ],
  );
}

export function createOpenCubeSoup(size = 40): TriangleSoup {
  const cube = createCubeSoup(size);
  return { positions: cube.positions.slice(0, -18) };
}

export function createDisconnectedCubesSoup(size = 10): TriangleSoup {
  return {
    positions: [
      ...createCubeSoup(size, [-size, 0, 0]).positions,
      ...createCubeSoup(size, [size, 0, 0]).positions,
    ],
  };
}

export function createNonManifoldSoup(): TriangleSoup {
  return soupFromIndexed(
    [
      [0, 0, 0],
      [10, 0, 0],
      [0, 10, 0],
      [0, -10, 0],
      [0, 0, 10],
    ],
    [0, 1, 2, 1, 0, 3, 0, 1, 4],
  );
}

export function createCylinderSoup(radius = 10, height = 30, sides = 24): TriangleSoup {
  const vertices: Vertex[] = [];
  const halfHeight = height / 2;
  for (let index = 0; index < sides; index += 1) {
    const angle = (index / sides) * Math.PI * 2;
    vertices.push([Math.cos(angle) * radius, Math.sin(angle) * radius, -halfHeight]);
    vertices.push([Math.cos(angle) * radius, Math.sin(angle) * radius, halfHeight]);
  }
  const bottomCentre = vertices.push([0, 0, -halfHeight]) - 1;
  const topCentre = vertices.push([0, 0, halfHeight]) - 1;
  const indices: number[] = [];
  for (let index = 0; index < sides; index += 1) {
    const next = (index + 1) % sides;
    const bottom = index * 2;
    const top = bottom + 1;
    const nextBottom = next * 2;
    const nextTop = nextBottom + 1;
    indices.push(bottom, nextTop, nextBottom, bottom, top, nextTop);
    indices.push(bottomCentre, nextBottom, bottom, topCentre, top, nextTop);
  }
  return soupFromIndexed(vertices, indices);
}

export function createHollowPrismSoup(outerSize = 30, innerSize = 12, height = 20): TriangleSoup {
  const outer = outerSize / 2;
  const inner = innerSize / 2;
  const z0 = -height / 2;
  const z1 = height / 2;
  const ring = (z: number): Vertex[] => [
    [-outer, -outer, z],
    [outer, -outer, z],
    [outer, outer, z],
    [-outer, outer, z],
    [-inner, -inner, z],
    [-inner, inner, z],
    [inner, inner, z],
    [inner, -inner, z],
  ];
  const vertices = [...ring(z0), ...ring(z1)];
  const indices: number[] = [];
  for (let side = 0; side < 4; side += 1) {
    const next = (side + 1) % 4;
    indices.push(side, next, next + 8, side, next + 8, side + 8);
    const innerSide = 4 + side;
    const innerNext = 4 + next;
    indices.push(innerSide, innerSide + 8, innerNext + 8, innerSide, innerNext + 8, innerNext);
    const bottomOuterA = side;
    const bottomOuterB = next;
    const bottomInnerA = side === 0 ? 4 : side === 1 ? 7 : side === 2 ? 6 : 5;
    const bottomInnerB = next === 0 ? 4 : next === 1 ? 7 : next === 2 ? 6 : 5;
    indices.push(
      bottomOuterA,
      bottomInnerB,
      bottomOuterB,
      bottomOuterA,
      bottomInnerA,
      bottomInnerB,
    );
    indices.push(
      bottomOuterA + 8,
      bottomOuterB + 8,
      bottomInnerB + 8,
      bottomOuterA + 8,
      bottomInnerB + 8,
      bottomInnerA + 8,
    );
  }
  return soupFromIndexed(vertices, indices);
}
