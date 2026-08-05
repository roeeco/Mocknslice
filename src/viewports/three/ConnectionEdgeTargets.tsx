import { Line } from '@react-three/drei';
import { useMemo } from 'react';
import { Quaternion, Vector3 } from 'three';
import type { EditableAssemblyEdge } from '../../domain/connections';
import { useProjectStore } from '../../state/useProjectStore';

export function ConnectionEdgeTargets({
  edges,
  colourFor,
}: {
  edges: readonly EditableAssemblyEdge[];
  colourFor: (edge: EditableAssemblyEdge) => string;
}) {
  const selectedEntityId = useProjectStore((state) => state.selectedEntityId);
  const selectEntity = useProjectStore((state) => state.selectEntity);
  return (
    <>
      {edges.map((edge) => (
        <ConnectionEdgeTarget
          key={edge.id}
          edge={edge}
          colour={colourFor(edge)}
          selected={selectedEntityId === edge.id}
          onSelect={() => selectEntity(edge.id)}
        />
      ))}
    </>
  );
}

function ConnectionEdgeTarget({
  edge,
  colour,
  selected,
  onSelect,
}: {
  edge: EditableAssemblyEdge;
  colour: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const geometry = useMemo(() => {
    const start = new Vector3(...edge.startMm);
    const end = new Vector3(...edge.endMm);
    const direction = end.clone().sub(start);
    const length = direction.length();
    const midpoint = start.clone().add(end).multiplyScalar(0.5);
    const quaternion = new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      direction.normalize(),
    );
    return { length, midpoint, quaternion };
  }, [edge.endMm, edge.startMm]);
  return (
    <group>
      <Line
        points={[edge.startMm, edge.endMm]}
        color={selected ? '#f7b32b' : colour}
        lineWidth={selected ? 5 : 3}
        transparent
        opacity={edge.editable ? 0.95 : 0.35}
      />
      <mesh
        position={geometry.midpoint}
        quaternion={geometry.quaternion}
        onClick={(event) => {
          event.stopPropagation();
          if (edge.editable) onSelect();
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          if (edge.editable) document.body.classList.add('connection-edge-hover');
        }}
        onPointerOut={() => document.body.classList.remove('connection-edge-hover')}
      >
        <cylinderGeometry args={[2.6, 2.6, geometry.length, 8]} />
        <meshBasicMaterial transparent opacity={0.005} depthWrite={false} />
      </mesh>
    </group>
  );
}
