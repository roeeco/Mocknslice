import { Html, Line } from '@react-three/drei';
import { useMemo, useState } from 'react';
import { Quaternion, Vector3 } from 'three';
import type { EditableAssemblyEdge } from '../../domain/connections';
import { copy } from '../../locales';
import { useProjectStore } from '../../state/useProjectStore';
import { ConnectionFloatingEditor } from './ConnectionFloatingEditor';
import { useIsDraftPreview } from '../PreviewProject';

export interface ConnectionAppearance {
  treatment: 'finger' | 'butt' | 'crease' | 'cut' | 'boundary';
  hasGlueTab: boolean;
  overridden: boolean;
}

export function ConnectionEdgeTargets({
  edges,
  colourFor,
  appearanceFor,
  mode,
}: {
  edges: readonly EditableAssemblyEdge[];
  colourFor: (edge: EditableAssemblyEdge) => string;
  appearanceFor: (edge: EditableAssemblyEdge) => ConnectionAppearance;
  mode: 'panel-construction' | 'fold-template';
}) {
  const selectedEntityId = useProjectStore((state) => state.selectedEntityId);
  const selectEntity = useProjectStore((state) => state.selectEntity);
  const draft = useIsDraftPreview();
  if (draft) return null;
  return (
    <>
      {edges.map((edge) => (
        <ConnectionEdgeTarget
          key={edge.id}
          edge={edge}
          colour={colourFor(edge)}
          appearance={appearanceFor(edge)}
          mode={mode}
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
  appearance,
  mode,
  selected,
  onSelect,
}: {
  edge: EditableAssemblyEdge;
  colour: string;
  appearance: ConnectionAppearance;
  mode: 'panel-construction' | 'fold-template';
  selected: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
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
  const emphasised = hovered || selected;
  const emphasisColour = selected ? '#ffd166' : '#7df9ff';
  const treatmentLabel =
    appearance.treatment === 'finger'
      ? copy.connectionInspector.finger
      : appearance.treatment === 'butt'
        ? copy.connectionInspector.butt
        : appearance.treatment === 'crease'
          ? copy.connectionInspector.crease
          : appearance.treatment === 'cut'
            ? copy.connectionInspector.cut
            : copy.connectionInspector.freeEdge;
  return (
    <group>
      {!selected && (appearance.overridden || appearance.hasGlueTab) ? (
        <Html position={geometry.midpoint} center zIndexRange={[60, 0]}>
          <span
            className={`connection-treatment-badge treatment-${appearance.treatment}`}
            data-glue-tab={appearance.hasGlueTab || undefined}
          >
            {treatmentLabel}
            {appearance.hasGlueTab ? ` · ${copy.connectionInspector.glueTab}` : ''}
          </span>
        </Html>
      ) : null}
      {selected ? (
        <Html position={geometry.midpoint} center zIndexRange={[100, 0]}>
          <ConnectionFloatingEditor mode={mode} edge={edge} />
        </Html>
      ) : null}
      {appearance.hasGlueTab ? (
        <mesh position={geometry.midpoint} quaternion={geometry.quaternion} renderOrder={900}>
          <boxGeometry args={[Math.min(12, geometry.length / 3), geometry.length * 0.62, 0.9]} />
          <meshBasicMaterial
            color="#facc15"
            transparent
            opacity={0.48}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      ) : null}
      {emphasised ? (
        <>
          <mesh position={geometry.midpoint} quaternion={geometry.quaternion} renderOrder={1_000}>
            <cylinderGeometry
              args={[selected ? 2.5 : 2.1, selected ? 2.5 : 2.1, geometry.length, 12]}
            />
            <meshBasicMaterial
              color={emphasisColour}
              transparent
              opacity={selected ? 0.42 : 0.32}
              depthTest={false}
              depthWrite={false}
            />
          </mesh>
          {[edge.startMm, edge.endMm].map((position, index) => (
            <mesh key={index} position={position} renderOrder={1_001}>
              <sphereGeometry args={[selected ? 3.1 : 2.7, 16, 12]} />
              <meshBasicMaterial
                color={emphasisColour}
                transparent
                opacity={selected ? 0.75 : 0.58}
                depthTest={false}
                depthWrite={false}
              />
            </mesh>
          ))}
        </>
      ) : null}
      <Line
        points={[edge.startMm, edge.endMm]}
        color={emphasised ? emphasisColour : colour}
        lineWidth={selected ? 9 : hovered ? 7 : 3}
        transparent
        opacity={edge.editable ? 0.95 : 0.35}
        depthTest={!emphasised}
        depthWrite={!emphasised}
        renderOrder={emphasised ? 1_002 : 0}
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
          if (edge.editable) {
            setHovered(true);
            document.body.classList.add('connection-edge-hover');
          }
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.classList.remove('connection-edge-hover');
        }}
      >
        <cylinderGeometry args={[2.6, 2.6, geometry.length, 8]} />
        <meshBasicMaterial transparent opacity={0.005} depthWrite={false} />
      </mesh>
    </group>
  );
}
