import { Edges, Grid, OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { useProjectStore } from '../../state/useProjectStore';
import type { CameraPreset } from '../../state/types';

const cameraPositions: Record<CameraPreset, [number, number, number]> = {
  isometric: [82, 68, 82],
  front: [0, 0, 110],
  side: [110, 0, 0],
  top: [0, 110, 0.01],
};

function CameraRig() {
  const camera = useThree((state) => state.camera);
  const preset = useProjectStore((state) => state.cameraPreset);

  useEffect(() => {
    camera.position.set(...cameraPositions[preset]);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, preset]);

  return null;
}

export function CubeScene() {
  const project = useProjectStore((state) => state.project);
  const selectedEntityId = useProjectStore((state) => state.selectedEntityId);
  const selectEntity = useProjectStore((state) => state.selectEntity);
  const { widthMm, heightMm, depthMm } = project.model.dimensions;
  const selected = selectedEntityId === project.model.id;

  return (
    <>
      <color attach="background" args={['#e9e6dc']} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[70, 90, 50]} intensity={2.4} />
      <directionalLight position={[-50, 30, -20]} intensity={0.8} />
      <mesh
        aria-label="Generated 40 millimetre cube"
        onClick={(event) => {
          event.stopPropagation();
          selectEntity(project.model.id);
        }}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[widthMm, heightMm, depthMm]} />
        <meshStandardMaterial color={selected ? '#f97316' : '#315c52'} roughness={0.72} />
        <Edges color={selected ? '#7c2d12' : '#17322d'} />
      </mesh>
      <Grid
        args={[240, 240]}
        position={[0, -heightMm / 2, 0]}
        cellSize={10}
        sectionSize={50}
        cellColor="#a8a59c"
        sectionColor="#6d716c"
        fadeDistance={220}
        infiniteGrid
      />
      <CameraRig />
      <OrbitControls makeDefault enableDamping />
    </>
  );
}
