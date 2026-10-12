import type { SerializableTriangleMesh } from '../domain/geometry';
import { createCubeMesh } from '../geometry/mesh/createPrimitiveMesh';
const cube = createCubeMesh(40).mesh;
export function subdividedCube(): SerializableTriangleMesh {
  let mesh = cube;
  for (let pass = 0; pass < 2; pass++) {
    const positionsMm = [...mesh.positionsMm],
      mids = new Map<string, number>();
    const mid = (a: number, b: number) => {
      const key = [a, b].sort((x, y) => x - y).join(':');
      if (mids.has(key)) return mids.get(key)!;
      const id = positionsMm.length / 3;
      for (let i = 0; i < 3; i++)
        positionsMm.push((mesh.positionsMm[a * 3 + i]! + mesh.positionsMm[b * 3 + i]!) / 2);
      mids.set(key, id);
      return id;
    };
    const indices: number[] = [];
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const [a, b, c] = mesh.indices.slice(i, i + 3) as [number, number, number],
        ab = mid(a, b),
        bc = mid(b, c),
        ca = mid(c, a);
      indices.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
    }
    mesh = { positionsMm, indices };
  }
  return mesh;
}
