import { Edges } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import type { MeshUnfoldFace } from '../../domain/unfolding';
import type { Vector3Mm } from '../../domain/geometry';
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
  const selectEntity = useProjectStore((state) => state.selectEntity);
  const geometry = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(
        positions.flatMap((point) => [point[0] - centre[0], point[1] - centre[1], point[2]]),
        3,
      ),
    );
    geometry.setIndex([0, 1, 2]);
    geometry.computeVertexNormals();
    return geometry;
  }, [centre, positions]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  const selected = selectedEntityId === face.id;
  return (
    <mesh
      geometry={geometry}
      castShadow
      receiveShadow
      onClick={(event) => {
        event.stopPropagation();
        selectEntity(face.id);
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
      <Edges color={selected ? '#7c2d12' : '#243b35'} threshold={8} />
    </mesh>
  );
}

export function MeshUnfoldAssembly() {
  const result = useProjectStore((state) => state.project.unfoldingResult);
  const progress = useProjectStore((state) => state.foldPreviewProgress);
  const positions = useMemo<UnfoldedFaceVertices>(
    () =>
      result
        ? unfoldedFaceVerticesAtProgress(result, progress)
        : new Map<string, [Vector3Mm, Vector3Mm, Vector3Mm]>(),
    [progress, result],
  );
  const centre = useMemo<[number, number]>(() => {
    if (!result?.faces.length) return [0, 0];
    const points = result.faces.flatMap((face) => face.points2D);
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    return [(minX + maxX) / 2, (minY + maxY) / 2];
  }, [result]);
  if (!result?.faces.length) return null;
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} data-testid="mesh-unfold-assembly">
      {result.faces.map((face) => {
        const facePositions = positions.get(face.id);
        return facePositions ? (
          <UnfoldFaceMesh key={face.id} face={face} centre={centre} positions={facePositions} />
        ) : null;
      })}
    </group>
  );
}
