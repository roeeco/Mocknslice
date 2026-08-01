import { Edges, Grid, OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import type { SerializableTriangleMesh } from '../../domain/geometry';
import { useProjectStore } from '../../state/useProjectStore';
import type { CameraPreset } from '../../state/types';
import { FabricationParts } from './FabricationParts';
import { FoldingAssembly } from './FoldingAssembly';
import { MeshUnfoldAssembly } from './MeshUnfoldAssembly';
import { PanelConstructionAssembly } from './PanelConstructionAssembly';

const cameraDirections: Record<CameraPreset, [number, number, number]> = {
  isometric: [1, 0.82, 1],
  front: [0, 0, 1],
  side: [1, 0, 0],
  top: [0, 1, 0.0001],
};

function CameraRig() {
  const camera = useThree((state) => state.camera);
  const preset = useProjectStore((state) => state.cameraPreset);
  const resetToken = useProjectStore((state) => state.cameraResetToken);
  const dimensions = useProjectStore((state) => state.project.model.dimensions);
  const unfoldingResult = useProjectStore((state) => state.project.unfoldingResult);
  const panelResult = useProjectStore((state) => state.project.panelConstructionResult);

  useEffect(() => {
    const unfoldedPoints = unfoldingResult?.faces.flatMap((face) => face.points2D) ?? [];
    const unfoldedWidth = unfoldedPoints.length
      ? Math.max(...unfoldedPoints.map((point) => point.x)) -
        Math.min(...unfoldedPoints.map((point) => point.x))
      : 0;
    const unfoldedHeight = unfoldedPoints.length
      ? Math.max(...unfoldedPoints.map((point) => point.y)) -
        Math.min(...unfoldedPoints.map((point) => point.y))
      : 0;
    const largestDimension = Math.max(
      dimensions.widthMm,
      dimensions.heightMm,
      dimensions.depthMm,
      unfoldedWidth,
      unfoldedHeight,
      panelResult?.settings.innerWidthMm ?? 0,
      panelResult?.settings.innerDepthMm ?? 0,
      panelResult?.settings.innerHeightMm ?? 0,
      10,
    );
    const distance = largestDimension * 2.45;
    const direction = cameraDirections[preset];
    // R3F intentionally exposes the Three.js camera as a mutable scene object.
    camera.position.set(direction[0] * distance, direction[1] * distance, direction[2] * distance);
    // eslint-disable-next-line react-hooks/immutability
    camera.near = Math.max(0.01, largestDimension / 1000);
    camera.far = Math.max(1000, largestDimension * 20);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, dimensions, panelResult, preset, resetToken, unfoldingResult]);

  return null;
}

function ImportedGeometry({ mesh }: { mesh: SerializableTriangleMesh }) {
  const geometry = useMemo(() => {
    const bufferGeometry = new BufferGeometry();
    bufferGeometry.setAttribute('position', new Float32BufferAttribute(mesh.positionsMm, 3));
    bufferGeometry.setIndex(mesh.indices);
    bufferGeometry.computeVertexNormals();
    return bufferGeometry;
  }, [mesh]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  return <primitive object={geometry} attach="geometry" />;
}

export function ModelScene() {
  const model = useProjectStore((state) => state.project.model);
  const hasParts = useProjectStore((state) => state.project.generatedParts.length > 0);
  const selectedEntityId = useProjectStore((state) => state.selectedEntityId);
  const selectEntity = useProjectStore((state) => state.selectEntity);
  const fabricationMode = useProjectStore((state) => state.project.fabricationMode);
  const { widthMm, heightMm, depthMm } = model.dimensions;
  const selected = selectedEntityId === model.id;
  const largestDimension = Math.max(widthMm, heightMm, depthMm, 10);

  return (
    <>
      <color attach="background" args={['#e9e6dc']} />
      <ambientLight intensity={1.5} />
      <directionalLight
        position={[largestDimension, largestDimension * 1.3, largestDimension]}
        intensity={2.4}
      />
      <directionalLight
        position={[-largestDimension, largestDimension * 0.5, -largestDimension]}
        intensity={0.8}
      />
      {fabricationMode !== 'panel-construction' ? (
        <mesh
          onClick={(event) => {
            event.stopPropagation();
            selectEntity(model.id);
          }}
          castShadow
          receiveShadow
        >
          {model.mesh ? (
            <ImportedGeometry mesh={model.mesh} />
          ) : (
            <boxGeometry args={[widthMm, heightMm, depthMm]} />
          )}
          <meshStandardMaterial
            color={selected ? '#f97316' : '#315c52'}
            roughness={0.72}
            side={2}
            transparent={hasParts}
            opacity={hasParts ? 0.16 : 1}
            depthWrite={!hasParts}
          />
          {!model.mesh ? <Edges color={selected ? '#7c2d12' : '#17322d'} /> : null}
        </mesh>
      ) : null}
      <FabricationParts />
      <FoldingAssembly />
      <MeshUnfoldAssembly />
      <PanelConstructionAssembly />
      <Grid
        args={[largestDimension * 6, largestDimension * 6]}
        position={[0, -heightMm / 2, 0]}
        cellSize={10}
        sectionSize={50}
        cellColor="#a8a59c"
        sectionColor="#6d716c"
        fadeDistance={largestDimension * 6}
        infiniteGrid
      />
      <CameraRig />
      <OrbitControls makeDefault enableDamping />
    </>
  );
}
