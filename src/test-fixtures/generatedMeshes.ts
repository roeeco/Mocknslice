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
