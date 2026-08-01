import type { TriangleSoup } from '../geometry/mesh/normalizeMesh';

const BINARY_HEADER_BYTES = 84;
const BINARY_TRIANGLE_BYTES = 50;

function parseBinaryStl(arrayBuffer: ArrayBuffer, triangleCount: number): TriangleSoup {
  const view = new DataView(arrayBuffer);
  const positions: number[] = [];
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const triangleOffset = BINARY_HEADER_BYTES + triangle * BINARY_TRIANGLE_BYTES;
    const vertexOffset = triangleOffset + 12;
    for (let coordinate = 0; coordinate < 9; coordinate += 1) {
      positions.push(view.getFloat32(vertexOffset + coordinate * 4, true));
    }
  }
  return { positions };
}

function parseAsciiStl(arrayBuffer: ArrayBuffer): TriangleSoup {
  const source = new TextDecoder().decode(arrayBuffer);
  const positions: number[] = [];
  const number = '([+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?)';
  const vertexPattern = new RegExp(`\\bvertex\\s+${number}\\s+${number}\\s+${number}`, 'gi');
  for (const match of source.matchAll(vertexPattern)) {
    positions.push(Number(match[1]), Number(match[2]), Number(match[3]));
  }
  return { positions };
}

export function parseStl(arrayBuffer: ArrayBuffer): TriangleSoup {
  if (arrayBuffer.byteLength >= BINARY_HEADER_BYTES) {
    const triangleCount = new DataView(arrayBuffer).getUint32(80, true);
    const expectedBytes = BINARY_HEADER_BYTES + triangleCount * BINARY_TRIANGLE_BYTES;
    if (triangleCount > 0 && expectedBytes <= arrayBuffer.byteLength) {
      return parseBinaryStl(arrayBuffer, triangleCount);
    }
  }
  return parseAsciiStl(arrayBuffer);
}
