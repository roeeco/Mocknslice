import { useMemo, useState } from 'react';
import { Line } from '@react-three/drei';
import type { MeshUnfoldResult } from '../../domain/unfolding';
import type { UnfoldedFaceVertices } from '../../geometry/unfolding/foldPreview';
import { useProjectStore } from '../../state/useProjectStore';
export function PapercraftEdgeTargets({
  result,
  positions,
  centre,
}: {
  result: MeshUnfoldResult;
  positions: UnfoldedFaceVertices;
  centre: [number, number];
}) {
  const native = useProjectStore((s) => s.project.papercraft?.result),
    select = useProjectStore((s) => s.selectEntity),
    selected = useProjectStore((s) => s.selectedEntityId),
    [hover, setHover] = useState<string>();
  const targets = useMemo(
    () =>
      result.edges.flatMap((edge) =>
        [
          edge.faceAIndex,
          ...(edge.disposition === 'hinge'
            ? []
            : edge.faceBIndex === undefined
              ? []
              : [edge.faceBIndex]),
        ].map((index) => ({ edge, face: result.faces.find((f) => f.faceIndex === index)! })),
      ),
    [result],
  );
  if (!native || result.algorithmVersion !== 'papercraft-v2') return null;
  return (
    <group>
      {targets.map(({ edge, face }) => {
        const vertices = positions.get(face.id);
        if (!vertices) return null;
        const a = vertices[face.sourceVertexIndices.indexOf(edge.vertexA)]!,
          b = vertices[face.sourceVertexIndices.indexOf(edge.vertexB)]!,
          active = selected === edge.id;
        return (
          <Line
            key={`${edge.id}:${face.id}`}
            points={[
              [a[0] - centre[0], a[1] - centre[1], a[2] + 0.1],
              [b[0] - centre[0], b[1] - centre[1], b[2] + 0.1],
            ]}
            lineWidth={active || hover === edge.id ? 5 : 3}
            color={active ? '#f7b32b' : hover === edge.id ? '#95c5a1' : '#547465'}
            onPointerOver={(event) => {
              event.stopPropagation();
              setHover(edge.id);
            }}
            onPointerOut={() => setHover(undefined)}
            onClick={(event) => {
              event.stopPropagation();
              select(edge.id, face.partId);
            }}
          />
        );
      })}
    </group>
  );
}
