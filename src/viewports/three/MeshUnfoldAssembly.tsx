import { papercraftFaceVerticesAtProgress } from '../../geometry/papercraft/foldPreview';
import { PapercraftEdgeTargets } from './PapercraftEdgeTargets';
import { useDisplayedProjectField } from '../PreviewProject';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import type { MeshUnfoldFace } from '../../domain/unfolding';
import type { Vector3Mm } from '../../domain/geometry';
import { assemblySelectionPanelIds } from '../../domain/assembly';
import {
  unfoldedFaceVerticesAtProgress,
  type UnfoldedFaceVertices,
} from '../../geometry/unfolding/foldPreview';
import { useProjectStore } from '../../state/useProjectStore';

const faceColours = ['#db6435', '#3f7f70', '#d8a13d', '#806a9e', '#4e7596'];

function UnfoldFaceMesh({
  face,
  centre,
  positions,
}: {
  face: MeshUnfoldFace;
  centre: [number, number];
  positions: [Vector3Mm, Vector3Mm, Vector3Mm];
}) {
  const selectedEntityId = useProjectStore((state) => state.selectedEntityId);
  const project = useDisplayedProjectField((project) => project);
  const relatedPanelIds = assemblySelectionPanelIds(project, selectedEntityId);
  const selectEntity = useProjectStore((state) => state.selectEntity);
  const geometry = useMemo(() => {
    const mesh = new BufferGeometry();
    mesh.name = face.id;
    mesh.setAttribute('position', new Float32BufferAttribute(new Float32Array(9), 3));
    mesh.setIndex([0, 1, 2]);
    return mesh;
  }, [face.id]);
  const wire = useMemo(() => {
    const lines = new BufferGeometry();
    lines.name = face.id;
    lines.setAttribute('position', new Float32BufferAttribute(new Float32Array(18), 3));
    return lines;
  }, [face.id]);
  useLayoutEffect(() => {
    const buffer = geometry.getAttribute('position'),
      edgeBuffer = wire.getAttribute('position');
    positions.forEach((p, i) => buffer.setXYZ(i, p[0] - centre[0], p[1] - centre[1], p[2]));
    [0, 1, 1, 2, 2, 0].forEach((index, i) => {
      const p = positions[index]!;
      edgeBuffer.setXYZ(i, p[0] - centre[0], p[1] - centre[1], p[2]);
    });
    buffer.needsUpdate = true;
    edgeBuffer.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    wire.computeBoundingSphere();
  }, [positions, centre, geometry, wire]);
  useEffect(
    () => () => {
      geometry.dispose();
      wire.dispose();
    },
    [geometry, wire],
  );
  if (!geometry) return null;
  const selected = selectedEntityId === face.id || relatedPanelIds.has(face.id);
  return (
    <mesh
      geometry={geometry}
      castShadow
      receiveShadow
      onClick={(event) => {
        event.stopPropagation();
        selectEntity(face.id, face.partId);
      }}
    >
      <meshStandardMaterial
        color={
          selected ? '#f7b32b' : (faceColours[face.islandIndex % faceColours.length] ?? '#3f7f70')
        }
        roughness={0.74}
        metalness={0.01}
        side={2}
        transparent
        opacity={0.86}
      />
      <lineSegments geometry={wire}>
        <lineBasicMaterial color={selected ? '#7c2d12' : '#243b35'} />
      </lineSegments>
    </mesh>
  );
}

export function MeshUnfoldAssembly() {
  const result = useDisplayedProjectField((project) => project.unfoldingResult);
  const native = useDisplayedProjectField((project) =>
    project.fabricationMode === 'mesh-unfold' ? project.papercraft?.result : undefined,
  );
  const progress = useProjectStore((state) => state.foldPreviewProgress);
  const positions = useMemo<UnfoldedFaceVertices>(
    () =>
      result
        ? native
          ? papercraftFaceVerticesAtProgress(native, progress)
          : unfoldedFaceVerticesAtProgress(result, progress)
        : new Map<string, [Vector3Mm, Vector3Mm, Vector3Mm]>(),
    [progress, result, native],
  );
  const centre = useMemo<[number, number]>(() => {
    if (native || !result?.faces.length) return [0, 0];
    const points = result.faces.flatMap((face) => face.points2D);
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    return [(minX + maxX) / 2, (minY + maxY) / 2];
  }, [result, native]);
  if (!result?.faces.length) return null;
  return (
    <group rotation={native ? [0, 0, 0] : [-Math.PI / 2, 0, 0]} data-testid="mesh-unfold-assembly">
      <PapercraftEdgeTargets result={result} positions={positions} centre={centre} />
      {result.faces.map((face) => {
        const facePositions = positions.get(face.id);
        return facePositions ? (
          <UnfoldFaceMesh key={face.id} face={face} centre={centre} positions={facePositions} />
        ) : null;
      })}
    </group>
  );
}
