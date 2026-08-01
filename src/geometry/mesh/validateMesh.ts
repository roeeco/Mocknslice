import type { ModelHealthReport } from '../../domain/model';
import type { SerializableTriangleMesh } from '../../domain/geometry';

interface EdgeUse {
  triangle: number;
  from: number;
  to: number;
}

class DisjointSet {
  private readonly parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
  }

  find(value: number): number {
    const parent = this.parent[value];
    if (parent === undefined) throw new Error('Invalid triangle index.');
    if (parent === value) return value;
    const root = this.find(parent);
    this.parent[value] = root;
    return root;
  }

  union(left: number, right: number): void {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot !== rightRoot) this.parent[rightRoot] = leftRoot;
  }
}

function vertex(mesh: SerializableTriangleMesh, index: number): [number, number, number] {
  const offset = index * 3;
  const x = mesh.positionsMm[offset];
  const y = mesh.positionsMm[offset + 1];
  const z = mesh.positionsMm[offset + 2];
  if (x === undefined || y === undefined || z === undefined) {
    throw new Error('Mesh index points outside the position array.');
  }
  return [x, y, z];
}

export function validateMeshTopology(
  mesh: SerializableTriangleMesh,
  weldedVertexCount: number,
): ModelHealthReport {
  const triangleCount = mesh.indices.length / 3;
  const edges = new Map<string, EdgeUse[]>();
  const sets = new DisjointSet(triangleCount);
  let signedVolumeMm3 = 0;

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const offset = triangle * 3;
    const aIndex = mesh.indices[offset];
    const bIndex = mesh.indices[offset + 1];
    const cIndex = mesh.indices[offset + 2];
    if (aIndex === undefined || bIndex === undefined || cIndex === undefined) {
      throw new Error('Mesh indices must contain complete triangles.');
    }

    const a = vertex(mesh, aIndex);
    const b = vertex(mesh, bIndex);
    const c = vertex(mesh, cIndex);
    signedVolumeMm3 +=
      (a[0] * (b[1] * c[2] - b[2] * c[1]) +
        a[1] * (b[2] * c[0] - b[0] * c[2]) +
        a[2] * (b[0] * c[1] - b[1] * c[0])) /
      6;

    const triangleEdges: [number, number][] = [
      [aIndex, bIndex],
      [bIndex, cIndex],
      [cIndex, aIndex],
    ];
    for (const [from, to] of triangleEdges) {
      const key = from < to ? `${from}:${to}` : `${to}:${from}`;
      const uses = edges.get(key) ?? [];
      uses.push({ triangle, from, to });
      edges.set(key, uses);
    }
  }

  let openEdgeCount = 0;
  let nonManifoldEdgeCount = 0;
  let orientationIssueCount = 0;

  for (const uses of edges.values()) {
    if (uses.length === 1) openEdgeCount += 1;
    if (uses.length > 2) nonManifoldEdgeCount += 1;
    if (uses.length === 2) {
      const first = uses[0];
      const second = uses[1];
      if (!first || !second) continue;
      sets.union(first.triangle, second.triangle);
      if (first.from === second.from && first.to === second.to) orientationIssueCount += 1;
    } else if (uses.length > 2) {
      const first = uses[0];
      if (!first) continue;
      for (const use of uses.slice(1)) sets.union(first.triangle, use.triangle);
    }
  }

  const shellRoots = new Set<number>();
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    shellRoots.add(sets.find(triangle));
  }

  const closedAndConsistent =
    openEdgeCount === 0 && nonManifoldEdgeCount === 0 && orientationIssueCount === 0;

  return {
    triangleCount,
    openEdgeCount,
    nonManifoldEdgeCount,
    disconnectedShellCount: shellRoots.size,
    orientationIssueCount,
    weldedVertexCount,
    signedVolumeMm3,
    likelyInverted: closedAndConsistent && signedVolumeMm3 < -1e-9,
    inspected: true,
  };
}
