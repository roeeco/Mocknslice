import { usePreparedOutput } from '../../geometry/output/PreparedOutputContext';
import { useDisplayedProjectField } from '../PreviewProject';
import { useEffect, useMemo } from 'react';
import { ExtrudeGeometry, Path, Shape } from 'three';
import type { FabricationPart } from '../../domain/fabrication';
import { useProjectStore } from '../../state/useProjectStore';

function contourPath(points: FabricationPart['paths'][number]['points'], shape: Shape | Path) {
  const first = points[0];
  if (!first) return;
  shape.moveTo(first.x, first.y);
  for (const point of points.slice(1)) shape.lineTo(point.x, point.y);
  shape.closePath();
}

function PartMesh({ part }: { part: FabricationPart }) {
  const selectedEntityId = useProjectStore((state) => state.selectedEntityId);
  const selectEntity = useProjectStore((state) => state.selectEntity);
  const geometry = useMemo(() => {
    const outer = part.paths.find((path) => path.contourRole !== 'hole');
    if (!outer || !part.slice) return undefined;
    const shape = new Shape();
    contourPath(outer.points, shape);
    for (const hole of part.paths.filter((path) => path.contourRole === 'hole')) {
      const holePath = new Path();
      contourPath(hole.points, holePath);
      shape.holes.push(holePath);
    }
    const result = new ExtrudeGeometry(shape, { depth: part.thicknessMm, bevelEnabled: false });
    if (part.slice.axis === 'x') {
      result.rotateY(-Math.PI / 2);
      result.translate(part.slice.positionMm + part.thicknessMm / 2, 0, 0);
    } else if (part.slice.axis === 'y') {
      result.rotateX(Math.PI / 2);
      result.translate(0, part.slice.positionMm + part.thicknessMm / 2, 0);
    } else {
      result.translate(0, 0, part.slice.positionMm - part.thicknessMm / 2);
    }
    result.computeVertexNormals();
    return result;
  }, [part]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  const selected = selectedEntityId === part.id;
  const color =
    part.waffle?.family === 'a' ? '#d85c2f' : part.waffle?.family === 'b' ? '#3f7f70' : '#d85c2f';
  return (
    <mesh
      geometry={geometry}
      castShadow
      receiveShadow
      onClick={(event) => {
        event.stopPropagation();
        selectEntity(part.id);
      }}
    >
      <meshStandardMaterial color={selected ? '#f59e0b' : color} roughness={0.7} metalness={0.02} />
    </mesh>
  );
}

export function FabricationParts() {
  const project = useDisplayedProjectField((project) => project);
  const parts = usePreparedOutput(project).preparedParts;
  return (
    <>
      {parts.map((part) => (
        <PartMesh key={part.id} part={part} />
      ))}
    </>
  );
}
