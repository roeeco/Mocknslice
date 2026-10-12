import { expect, it } from 'vitest';
import { assembledPanelGeometry } from './assembledPanelGeometry';
it('renders a concave assembled panel with a genuine hole rather than filling its bounding fan', () => {
  const geometry = assembledPanelGeometry({
    id: 'panel',
    partId: 'part',
    name: 'Concave',
    verticesMm: [
      [0, 0, 0],
      [10, 0, 0],
      [10, 0, 4],
      [4, 0, 4],
      [4, 0, 10],
      [0, 0, 10],
    ],
    holesVerticesMm: [
      [
        [1, 0, 1],
        [1, 0, 3],
        [3, 0, 3],
        [3, 0, 1],
      ],
    ],
  });
  const positions = geometry.getAttribute('position'),
    indices = geometry.getIndex()!;
  let area = 0;
  for (let i = 0; i < indices.count; i += 3) {
    const a = indices.getX(i),
      b = indices.getX(i + 1),
      c = indices.getX(i + 2);
    area +=
      Math.abs(
        (positions.getX(b) - positions.getX(a)) * (positions.getZ(c) - positions.getZ(a)) -
          (positions.getZ(b) - positions.getZ(a)) * (positions.getX(c) - positions.getX(a)),
      ) / 2;
  }
  expect(area).toBeCloseTo(60, 6);
  geometry.dispose();
});
