import type { PanelConnectionKey } from '../../domain/panelConstruction';
import { copy } from '../../locales';
import { useProjectStore } from '../../state/useProjectStore';

function panelName(id: string, names: Map<string, string>): string {
  return (names.get(id) ?? id.replace(/^construction-panel-/, '')).replace(/ panel$/i, '');
}

export function ConnectionInspector({ mode }: { mode: 'panel-construction' | 'fold-template' }) {
  const project = useProjectStore((state) => state.project);
  const selectedEntityId = useProjectStore((state) => state.selectedEntityId);
  const selectEntity = useProjectStore((state) => state.selectEntity);
  const updatePanel = useProjectStore((state) => state.updatePanelComposerSettings);
  const updateFold = useProjectStore((state) => state.updateFoldTemplateSettings);
  const labels = copy.connectionInspector;
  const result =
    mode === 'panel-construction' ? project.panelConstructionResult : project.foldingResult;
  const edges = result?.editableEdges ?? [];
  const selected = edges.find((edge) => edge.id === selectedEntityId);
  const names = new Map(
    (result?.assembledPreview.panels ?? []).map((panel) => [panel.id, panel.name]),
  );
  const panelSettings = project.modeSettings.panelConstruction;
  const foldSettings = project.modeSettings.foldTemplate;
  const panelOverride =
    mode === 'panel-construction' && selected?.kind === 'connection'
      ? panelSettings.connectionOverrides[selected.id as PanelConnectionKey]
      : undefined;
  const panelTreatment = panelOverride?.treatment ?? panelSettings.jointKind;

  return (
    <details className="connection-inspector" aria-labelledby={`${mode}-connections-heading`}>
      <summary id={`${mode}-connections-heading`}>{labels.heading}</summary>
      <div className="connection-inspector-body">
        {!result || edges.length === 0 ? (
          <p className="field-help">{labels.generateFirst}</p>
        ) : (
          <>
            <p className="field-help">{labels.intro}</p>
            <label>
              <span>{labels.edgeList}</span>
              <select
                value={selected?.id ?? ''}
                onChange={(event) => event.target.value && selectEntity(event.target.value)}
              >
                <option value="">{labels.selectPrompt}</option>
                {edges.map((edge) => (
                  <option value={edge.id} disabled={!edge.editable} key={edge.id}>
                    {panelName(edge.panelAId, names)}
                    {edge.panelBId
                      ? ` ↔ ${panelName(edge.panelBId, names)}`
                      : ` · ${edge.id.split(':').at(-1)}`}
                  </option>
                ))}
              </select>
            </label>
            {mode === 'panel-construction' &&
            selected?.kind === 'connection' &&
            panelTreatment === 'finger' ? (
              <label>
                <span>{labels.fitClearance}</span>
                <input
                  type="number"
                  min={0}
                  step={0.05}
                  value={panelOverride?.clearanceMm ?? panelSettings.clearanceMm}
                  onChange={(event) => {
                    if (!Number.isFinite(event.target.valueAsNumber)) return;
                    updatePanel({
                      connectionOverrides: {
                        ...panelSettings.connectionOverrides,
                        [selected.id]: {
                          treatment: 'finger',
                          clearanceMm: Math.max(0, event.target.valueAsNumber),
                        },
                      },
                    });
                  }}
                />
              </label>
            ) : null}
            <label>
              <span>
                {labels.tabDepth}:{' '}
                {mode === 'panel-construction'
                  ? panelSettings.glueTabDepthMm
                  : foldSettings.glueTabDepthMm}{' '}
                mm
              </span>
              <input
                type="range"
                min={0.5}
                max={15}
                step={0.5}
                value={
                  mode === 'panel-construction'
                    ? panelSettings.glueTabDepthMm
                    : foldSettings.glueTabDepthMm
                }
                onChange={(event) =>
                  mode === 'panel-construction'
                    ? updatePanel({ glueTabDepthMm: event.target.valueAsNumber })
                    : updateFold({ glueTabDepthMm: event.target.valueAsNumber })
                }
              />
            </label>
            <p className="field-help">{labels.legend}</p>
          </>
        )}
      </div>
    </details>
  );
}
