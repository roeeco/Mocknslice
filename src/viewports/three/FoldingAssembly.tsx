import { useEffect, useMemo } from 'react';
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from 'three';
import type { AssembledFoldPanel } from '../../domain/folding';
import { assemblySelectionPanelIds } from '../../domain/assembly';
import { useProjectStore } from '../../state/useProjectStore';
import { ConnectionEdgeTargets } from './ConnectionEdgeTargets';

const panelColors = ['#d85c2f', '#4f897b', '#e0a83e', '#607a9b', '#a45d78', '#73834d'];
const EMPTY_PANELS: readonly AssembledFoldPanel[] = [];

function PanelMesh({
  panel,
  index,
  relatedPanelIds,
}: {
  panel: AssembledFoldPanel;
  index: number;
  relatedPanelIds: ReadonlySet<string>;
}) {
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
        selectEntity(panel.id, panel.partId);
      }}
    >
      <meshStandardMaterial
        color={
          selectedEntityId === panel.id || relatedPanelIds.has(panel.id)
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
  const result = useProjectStore((state) => state.project.foldingResult);
  const panels = result?.assembledPreview.panels ?? EMPTY_PANELS;
  const project = useProjectStore((state) => state.project);
  const selectedEntityId = useProjectStore((state) => state.selectedEntityId);
  const relatedPanelIds = assemblySelectionPanelIds(project, selectedEntityId);
  return (
    <>
      {panels.map((panel, index) => (
        <PanelMesh key={panel.id} panel={panel} index={index} relatedPanelIds={relatedPanelIds} />
      ))}
      <ConnectionEdgeTargets
        mode="fold-template"
        edges={result?.editableEdges ?? []}
        colourFor={(edge) => {
          if (edge.kind === 'boundary') return '#64748b';
          const override = project.modeSettings.foldTemplate.connectionOverrides.find(
            (candidate) =>
              candidate.templateKind === project.modeSettings.foldTemplate.templateKind &&
              candidate.connectionId === edge.id,
          );
          const connection = result?.connections.find((candidate) => candidate.id === edge.id);
          const treatment =
            override?.treatment ?? (connection?.disposition === 'hinge' ? 'crease' : 'cut');
          return treatment === 'crease' ? '#2563eb' : '#dc2626';
        }}
        appearanceFor={(edge) => {
          if (edge.kind === 'boundary') {
            return {
              treatment: 'boundary',
              hasGlueTab: project.modeSettings.foldTemplate.boundaryGlueTabs.some(
                (tab) =>
                  tab.templateKind === project.modeSettings.foldTemplate.templateKind &&
                  tab.edgeId === edge.id,
              ),
              overridden: false,
            };
          }
          const override = project.modeSettings.foldTemplate.connectionOverrides.find(
            (candidate) =>
              candidate.templateKind === project.modeSettings.foldTemplate.templateKind &&
              candidate.connectionId === edge.id,
          );
          const connection = result?.connections.find((candidate) => candidate.id === edge.id);
          return {
            treatment:
              override?.treatment ?? (connection?.disposition === 'hinge' ? 'crease' : 'cut'),
            hasGlueTab: override?.closure === 'glue-tab',
            overridden: Boolean(override),
          };
        }}
      />
    </>
  );
}
