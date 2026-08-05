import { Edges } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { DoubleSide, ExtrudeGeometry, Matrix4, Path, Shape, Vector2, Vector3 } from 'three';
import type { AssembledFoldPanel } from '../../domain/folding';
import type { PanelConnectionKey } from '../../domain/panelConstruction';
import { useProjectStore } from '../../state/useProjectStore';
import { ConnectionEdgeTargets } from './ConnectionEdgeTargets';

const colours = ['#d15e35', '#39786a', '#d29a34', '#577896', '#8e658d', '#73834d'];
const EMPTY_PANELS: readonly AssembledFoldPanel[] = [];

function outwardDirection(panelId: string): Vector3 | undefined {
  if (panelId.endsWith('-base')) return new Vector3(0, -1, 0);
  if (panelId.endsWith('-front')) return new Vector3(0, 0, -1);
  if (panelId.endsWith('-back')) return new Vector3(0, 0, 1);
  if (panelId.endsWith('-left')) return new Vector3(-1, 0, 0);
  if (panelId.endsWith('-right')) return new Vector3(1, 0, 0);
  if (panelId.endsWith('-lid')) return new Vector3(0, 1, 0);
  return undefined;
}

function planarFrame(points: AssembledFoldPanel['verticesMm'], desiredNormal?: Vector3) {
  const origin = new Vector3(...points[0]!);
  const firstDistinct = points
    .slice(1)
    .map((point) => new Vector3(...point).sub(origin))
    .find((vector) => vector.lengthSq() > 1e-10);
  const u = firstDistinct?.normalize() ?? new Vector3(1, 0, 0);
  const normal =
    points
      .slice(2)
      .map((point) => new Vector3(...point).sub(origin).cross(u))
      .find((vector) => vector.lengthSq() > 1e-10)
      ?.normalize() ?? new Vector3(0, 1, 0);
  if (desiredNormal && normal.dot(desiredNormal) < 0) normal.multiplyScalar(-1);
  const v = new Vector3().crossVectors(normal, u).normalize();
  const project = (point: (typeof points)[number]) => {
    const relative = new Vector3(...point).sub(origin);
    return new Vector2(relative.dot(u), relative.dot(v));
  };
  const matrix = new Matrix4().makeBasis(u, v, normal);
  matrix.setPosition(origin);
  return { matrix, project };
}

function ConstructionPanelMesh({
  panel,
  index,
  thicknessMm,
}: {
  panel: AssembledFoldPanel;
  index: number;
  thicknessMm: number;
}) {
  const selectedEntityId = useProjectStore((state) => state.selectedEntityId);
  const selectedPartId = useProjectStore((state) => state.selectedPartId);
  const selectEntity = useProjectStore((state) => state.selectEntity);
  const geometry = useMemo(() => {
    const centredThickness = panel.id.includes('divider-');
    const { matrix, project } = planarFrame(panel.verticesMm, outwardDirection(panel.id));
    const shape = new Shape(panel.verticesMm.map(project));
    const holes = panel.holesVerticesMm ?? [];
    shape.holes.push(...holes.map((hole) => new Path(hole.map(project))));
    const result = new ExtrudeGeometry(shape, {
      depth: thicknessMm,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 1,
    });
    if (centredThickness) result.translate(0, 0, -thicknessMm / 2);
    result.applyMatrix4(matrix);
    return result;
  }, [panel, thicknessMm]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      geometry={geometry}
      castShadow
      receiveShadow
      onClick={(event) => {
        event.stopPropagation();
        selectEntity(panel.id, panel.partId);
      }}
    >
      <meshStandardMaterial
        color={
          selectedEntityId === panel.id || selectedPartId === panel.partId
            ? '#f7b32b'
            : (colours[index % colours.length] ?? '#39786a')
        }
        roughness={0.72}
        metalness={0.01}
        side={DoubleSide}
        polygonOffset
        polygonOffsetFactor={1}
      />
      <Edges color="#243b35" threshold={8} />
    </mesh>
  );
}

export function PanelConstructionAssembly() {
  const result = useProjectStore((state) => state.project.panelConstructionResult);
  const panels = result?.assembledPreview.panels ?? EMPTY_PANELS;
  const heightMm = useProjectStore(
    (state) => state.project.panelConstructionResult?.settings.innerHeightMm ?? 0,
  );
  const thicknessByPart = useMemo(
    () => new Map(result?.parts.map((part) => [part.id, part.thicknessMm]) ?? []),
    [result?.parts],
  );
  return (
    <group position={[0, -heightMm / 2, 0]}>
      {panels.map((panel, index) => (
        <ConstructionPanelMesh
          key={panel.id}
          panel={panel}
          index={index}
          thicknessMm={thicknessByPart.get(panel.partId) ?? 1}
        />
      ))}
      <ConnectionEdgeTargets
        edges={result?.editableEdges ?? []}
        colourFor={(edge) => {
          if (edge.kind === 'boundary') return '#64748b';
          const treatment =
            result?.settings.connectionOverrides?.[edge.id as PanelConnectionKey]?.treatment;
          return treatment === 'crease' ? '#2563eb' : treatment === 'butt' ? '#7c3aed' : '#dc2626';
        }}
      />
    </group>
  );
}
