import { Edges } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from 'three';
import type { AssembledFoldPanel } from '../../domain/folding';
import { useProjectStore } from '../../state/useProjectStore';

const colours = ['#d15e35', '#39786a', '#d29a34', '#577896', '#8e658d', '#73834d'];

function ConstructionPanelMesh({ panel, index }: { panel: AssembledFoldPanel; index: number }) {
  const selectedEntityId = useProjectStore((state) => state.selectedEntityId);
  const selectEntity = useProjectStore((state) => state.selectEntity);
  const geometry = useMemo(() => {
    const result = new BufferGeometry();
    result.setAttribute(
      'position',
      new Float32BufferAttribute(
        panel.verticesMm.flatMap((point) => point),
        3,
      ),
    );
    result.setIndex([0, 1, 2, 0, 2, 3]);
    result.computeVertexNormals();
    return result;
  }, [panel]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      geometry={geometry}
      castShadow
      receiveShadow
      onClick={(event) => {
        event.stopPropagation();
        selectEntity(panel.id);
      }}
    >
      <meshStandardMaterial
        color={
          selectedEntityId === panel.id ? '#f7b32b' : (colours[index % colours.length] ?? '#39786a')
        }
        roughness={0.72}
        metalness={0.01}
        transparent
        opacity={0.78}
        side={DoubleSide}
        polygonOffset
        polygonOffsetFactor={1}
      />
      <Edges color="#243b35" threshold={8} />
    </mesh>
  );
}

export function PanelConstructionAssembly() {
  const panels = useProjectStore(
    (state) => state.project.panelConstructionResult?.assembledPreview.panels ?? [],
  );
  const heightMm = useProjectStore(
    (state) => state.project.panelConstructionResult?.settings.innerHeightMm ?? 0,
  );
  return (
    <group position={[0, -heightMm / 2, 0]}>
      {panels.map((panel, index) => (
        <ConstructionPanelMesh key={panel.id} panel={panel} index={index} />
      ))}
    </group>
  );
}
