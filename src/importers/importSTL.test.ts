import { describe, expect, it } from 'vitest';
import { parseStl } from './importSTL';

const encoder = new TextEncoder();

describe('parseStl', () => {
  it('reads an ASCII STL into triangle soup coordinates', () => {
    const source = `solid triangle
facet normal 0 0 1
outer loop
vertex 0 0 0
vertex 10 0 0
vertex 0 10 0
endloop
endfacet
endsolid triangle`;
    const soup = parseStl(encoder.encode(source).buffer);
    expect(soup.positions).toEqual([0, 0, 0, 10, 0, 0, 0, 10, 0]);
  });

  it('reads a binary STL without depending on file metadata', () => {
    const buffer = new ArrayBuffer(84 + 50);
    const view = new DataView(buffer);
    view.setUint32(80, 1, true);
    const vertices = [0, 0, 0, 5, 0, 0, 0, 5, 0];
    vertices.forEach((value, index) => view.setFloat32(96 + index * 4, value, true));

    expect(parseStl(buffer).positions).toEqual(vertices);
  });
});
