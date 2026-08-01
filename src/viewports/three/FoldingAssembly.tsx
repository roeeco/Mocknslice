import { useEffect, useMemo } from 'react';
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from 'three';
import type { AssembledFoldPanel } from '../../domain/folding';
import { useProjectStore } from '../../state/useProjectStore';

const panelColors = ['#d85c2f', '#4f897b', '#e0a83e', '#607a9b', '#a45d78', '#73834d'];

function PanelMesh({ panel, index }: { panel: AssembledFoldPanel; index: number }) {
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
    const indices: number[] = [];
    for (let vertex = 1; vertex < panel.verticesMm.length - 1; vertex += 1) {
      indices.push(0, vertex, vertex + 1);
    }
    result.setIndex(indices);
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
          selectedEntityId === panel.id
            ? '#f59e0b'
            : (panelColors[index % panelColors.length] ?? '#d85c2f')
        }
        roughness={0.68}
        metalness={0.01}
        transparent
        opacity={0.72}
        side={DoubleSide}
      />
    </mesh>
  );
}

export function FoldingAssembly() {
  const panels = useProjectStore(
    (state) => state.project.foldingResult?.assembledPreview.panels ?? [],
  );
  return (
    <>
      {panels.map((panel, index) => (
        <PanelMesh key={panel.id} panel={panel} index={index} />
      ))}
    </>
  );
}
