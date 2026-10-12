import { Line } from '@react-three/drei';
import type { FabricationPart } from '../../domain/fabrication';
import type { Point2D, Vector3Mm } from '../../domain/geometry';
export function WaffleInsertionGuides({ part }: { part: FabricationPart }) {
  const slice = part.slice;
  if (!slice || !part.waffle) return null;
  const world = (p: Point2D): Vector3Mm =>
    slice.axis === 'x'
      ? [slice.positionMm + part.thicknessMm / 2 + 0.1, p.y, p.x]
      : slice.axis === 'y'
        ? [p.x, slice.positionMm + part.thicknessMm / 2 + 0.1, p.y]
        : [p.x, p.y, slice.positionMm + part.thicknessMm / 2 + 0.1];
  return (
    <group>
      {part.paths
        .filter((p) => p.operation === 'guide' && p.slot && p.points.length === 2)
        .map((path) => {
          const [a, b] = path.points as [Point2D, Point2D],
            length = Math.hypot(b.x - a.x, b.y - a.y),
            ux = (b.x - a.x) / length,
            uy = (b.y - a.y) / length,
            head = Math.min(2, length / 3);
          return (
            <group key={path.id}>
              <Line points={[world(a), world(b)]} color="#567569" lineWidth={2} />
              <Line
                points={[
                  world({
                    x: b.x - ux * head - (uy * head) / 2,
                    y: b.y - uy * head + (ux * head) / 2,
                  }),
                  world(b),
                  world({
                    x: b.x - ux * head + (uy * head) / 2,
                    y: b.y - uy * head - (ux * head) / 2,
                  }),
                ]}
                color="#567569"
                lineWidth={2}
              />
            </group>
          );
        })}
    </group>
  );
}
