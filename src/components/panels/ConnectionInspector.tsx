import type {
  BoundaryGlueTab,
  ConnectionClosure,
  FoldingConnectionTreatment,
  PanelConnectionTreatment,
} from '../../domain/connections';
import type { PanelConnectionKey } from '../../domain/panelConstruction';
import { copy } from '../../locales';
import { useProjectStore } from '../../state/useProjectStore';

function panelName(id: string, names: Map<string, string>): string {
  return names.get(id) ?? id.replace(/^construction-panel-/, '');
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

  if (!result || edges.length === 0) {
    return (
      <section className="connection-inspector" aria-labelledby={`${mode}-connections-heading`}>
        <h3 id={`${mode}-connections-heading`}>{labels.heading}</h3>
        <p className="field-help">{labels.generateFirst}</p>
      </section>
    );
  }

  const panelSettings = project.modeSettings.panelConstruction;
  const foldSettings = project.modeSettings.foldTemplate;
  const panelOverride =
    mode === 'panel-construction' && selected?.kind === 'connection'
      ? panelSettings.connectionOverrides[selected.id as PanelConnectionKey]
      : undefined;
  const foldConnection =
    mode === 'fold-template' && selected?.kind === 'connection'
      ? project.foldingResult?.connections.find((connection) => connection.id === selected.id)
      : undefined;
  const foldOverride =
    mode === 'fold-template' && selected?.kind === 'connection'
      ? foldSettings.connectionOverrides.find(
          (override) =>
            override.templateKind === foldSettings.templateKind &&
            override.connectionId === selected.id,
        )
      : undefined;

  const replaceFoldOverride = (patch: {
    treatment?: FoldingConnectionTreatment;
    closure?: ConnectionClosure;
    tabOwnerPanelId?: string;
    removeOwner?: boolean;
  }) => {
    if (!selected || selected.kind !== 'connection') return;
    const existingIndex = foldSettings.connectionOverrides.findIndex(
      (override) =>
        override.templateKind === foldSettings.templateKind &&
        override.connectionId === selected.id,
    );
    const existing =
      existingIndex >= 0 ? foldSettings.connectionOverrides[existingIndex] : undefined;
    const treatment =
      patch.treatment ??
      existing?.treatment ??
      (foldConnection?.disposition === 'hinge' ? 'crease' : 'cut');
    const closure =
      treatment === 'crease'
        ? 'none'
        : (patch.closure ??
          existing?.closure ??
          (foldConnection?.closure === 'glue-tab' || foldConnection?.closure === 'press-fit'
            ? foldConnection.closure
            : 'none'));
    const tabOwnerPanelId = patch.removeOwner
      ? undefined
      : (patch.tabOwnerPanelId ?? existing?.tabOwnerPanelId);
    const next = {
      id: existing?.id ?? `fold-override-${foldSettings.templateKind}-${selected.id}`,
      templateKind: foldSettings.templateKind,
      connectionId: selected.id,
      treatment,
      closure,
      ...(tabOwnerPanelId ? { tabOwnerPanelId } : {}),
    };
    const connectionOverrides = [...foldSettings.connectionOverrides];
    if (existingIndex >= 0) connectionOverrides[existingIndex] = next;
    else connectionOverrides.push(next);
    updateFold({ connectionOverrides });
  };

  const resetSelected = () => {
    if (!selected) return;
    if (mode === 'panel-construction') {
      if (selected.kind === 'connection') {
        const connectionOverrides = { ...panelSettings.connectionOverrides };
        delete connectionOverrides[selected.id as PanelConnectionKey];
        updatePanel({ connectionOverrides });
      } else {
        updatePanel({
          boundaryGlueTabs: panelSettings.boundaryGlueTabs.filter(
            (tab) => tab.edgeId !== selected.id,
          ),
        });
      }
    } else if (selected.kind === 'connection') {
      updateFold({
        connectionOverrides: foldSettings.connectionOverrides.filter(
          (override) =>
            override.templateKind !== foldSettings.templateKind ||
            override.connectionId !== selected.id,
        ),
      });
    } else {
      updateFold({
        boundaryGlueTabs: foldSettings.boundaryGlueTabs.filter(
          (tab) => tab.templateKind !== foldSettings.templateKind || tab.edgeId !== selected.id,
        ),
      });
    }
  };

  const boundaryEnabled = selected
    ? mode === 'panel-construction'
      ? panelSettings.boundaryGlueTabs.some((tab) => tab.edgeId === selected.id)
      : foldSettings.boundaryGlueTabs.some(
          (tab) => tab.templateKind === foldSettings.templateKind && tab.edgeId === selected.id,
        )
    : false;

  const toggleBoundaryTab = () => {
    if (!selected || selected.kind !== 'boundary') return;
    if (mode === 'panel-construction') {
      const retained = panelSettings.boundaryGlueTabs.filter((tab) => tab.edgeId !== selected.id);
      updatePanel({
        boundaryGlueTabs: boundaryEnabled
          ? retained
          : [
              ...retained,
              {
                id: `panel-boundary-tab-${selected.id}`,
                ownerPanelId: selected.panelAId,
                edgeId: selected.id,
              },
            ],
      });
    } else {
      const retained = foldSettings.boundaryGlueTabs.filter(
        (tab) => tab.templateKind !== foldSettings.templateKind || tab.edgeId !== selected.id,
      );
      const record: BoundaryGlueTab = {
        id: `fold-boundary-tab-${foldSettings.templateKind}-${selected.id}`,
        templateKind: foldSettings.templateKind,
        ownerPanelId: selected.panelAId,
        edgeId: selected.id,
      };
      updateFold({ boundaryGlueTabs: boundaryEnabled ? retained : [...retained, record] });
    }
  };

  return (
    <section className="connection-inspector" aria-labelledby={`${mode}-connections-heading`}>
      <h3 id={`${mode}-connections-heading`}>{labels.heading}</h3>
      <p className="field-help">{labels.intro}</p>
      <div className="connection-edge-list" role="list" aria-label={labels.edgeList}>
        {edges.map((edge) => (
          <button
            type="button"
            role="listitem"
            className={edge.id === selected?.id ? 'selected' : undefined}
            disabled={!edge.editable}
            title={edge.unavailableReason}
            onClick={() => selectEntity(edge.id)}
            key={edge.id}
          >
            {panelName(edge.panelAId, names)}
            {edge.panelBId
              ? ` ↔ ${panelName(edge.panelBId, names)}`
              : ` · ${edge.id.split(':').at(-1)}`}
          </button>
        ))}
      </div>
      {selected ? (
        <div className="connection-inspector-fields">
          <p>
            <strong>{panelName(selected.panelAId, names)}</strong>
            {selected.panelBId
              ? ` ↔ ${panelName(selected.panelBId, names)}`
              : ` · ${labels.freeEdge}`}
          </p>
          {selected.kind === 'connection' && mode === 'panel-construction' ? (
            <>
              <label>
                <span>{labels.edgeTreatment}</span>
                <select
                  value={panelOverride?.treatment ?? panelSettings.jointKind}
                  onChange={(event) => {
                    const treatment = event.target.value as PanelConnectionTreatment;
                    updatePanel({
                      connectionOverrides: {
                        ...panelSettings.connectionOverrides,
                        [selected.id]: {
                          treatment,
                          ...(treatment === 'finger' && panelOverride?.clearanceMm !== undefined
                            ? { clearanceMm: panelOverride.clearanceMm }
                            : {}),
                        },
                      },
                    });
                  }}
                >
                  <option value="finger">{labels.finger}</option>
                  <option value="butt">{labels.butt}</option>
                  <option value="crease">{labels.crease}</option>
                </select>
              </label>
              {(panelOverride?.treatment ?? panelSettings.jointKind) === 'butt' ? (
                <>
                  <label>
                    <span>{labels.closure}</span>
                    <select
                      value={panelOverride?.glueTabOwnerPanelId ? 'glue-tab' : 'none'}
                      onChange={(event) => {
                        const addTab = event.target.value === 'glue-tab';
                        updatePanel({
                          connectionOverrides: {
                            ...panelSettings.connectionOverrides,
                            [selected.id]: {
                              treatment: 'butt',
                              ...(addTab && panelOverride?.glueTabOwnerPanelId
                                ? { glueTabOwnerPanelId: panelOverride.glueTabOwnerPanelId }
                                : {}),
                            },
                          },
                        });
                      }}
                    >
                      <option value="none">{labels.none}</option>
                      <option value="glue-tab" disabled={!panelOverride?.glueTabOwnerPanelId}>
                        {labels.glueTab}
                      </option>
                    </select>
                  </label>
                  <label>
                    <span>{labels.glueOwner}</span>
                    <select
                      value={panelOverride?.glueTabOwnerPanelId ?? ''}
                      onChange={(event) =>
                        updatePanel({
                          connectionOverrides: {
                            ...panelSettings.connectionOverrides,
                            [selected.id]: {
                              treatment: 'butt',
                              ...(event.target.value
                                ? { glueTabOwnerPanelId: event.target.value }
                                : {}),
                            },
                          },
                        })
                      }
                    >
                      <option value="">{labels.selectOwner}</option>
                      <option value={selected.panelAId}>
                        {panelName(selected.panelAId, names)}
                      </option>
                      <option value={selected.panelBId}>
                        {panelName(selected.panelBId!, names)}
                      </option>
                    </select>
                  </label>
                </>
              ) : null}
              {(panelOverride?.treatment ?? panelSettings.jointKind) === 'finger' ? (
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
            </>
          ) : null}
          {selected.kind === 'connection' && mode === 'fold-template' ? (
            <>
              <label>
                <span>{labels.edgeTreatment}</span>
                <select
                  value={
                    foldOverride?.treatment ??
                    (foldConnection?.disposition === 'hinge' ? 'crease' : 'cut')
                  }
                  onChange={(event) =>
                    replaceFoldOverride({
                      treatment: event.target.value as FoldingConnectionTreatment,
                    })
                  }
                >
                  <option value="crease">{labels.crease}</option>
                  <option value="cut">{labels.cut}</option>
                </select>
              </label>
              {(foldOverride?.treatment ??
                (foldConnection?.disposition === 'hinge' ? 'crease' : 'cut')) === 'cut' ? (
                <>
                  <label>
                    <span>{labels.closure}</span>
                    <select
                      value={foldOverride?.closure ?? 'none'}
                      onChange={(event) =>
                        replaceFoldOverride({ closure: event.target.value as ConnectionClosure })
                      }
                    >
                      <option value="none">{labels.none}</option>
                      <option value="glue-tab">{labels.glueTab}</option>
                      <option value="press-fit">{labels.pressFit}</option>
                    </select>
                  </label>
                  <label>
                    <span>{labels.tabOwner}</span>
                    <select
                      value={foldOverride?.tabOwnerPanelId ?? ''}
                      onChange={(event) =>
                        replaceFoldOverride(
                          event.target.value
                            ? { tabOwnerPanelId: event.target.value }
                            : { removeOwner: true },
                        )
                      }
                    >
                      <option value="">{labels.selectOwner}</option>
                      <option value={selected.panelAId}>
                        {panelName(selected.panelAId, names)}
                      </option>
                      <option value={selected.panelBId}>
                        {panelName(selected.panelBId!, names)}
                      </option>
                    </select>
                  </label>
                </>
              ) : null}
            </>
          ) : null}
          {selected.kind === 'boundary' ? (
            <button type="button" disabled={!selected.editable} onClick={toggleBoundaryTab}>
              {boundaryEnabled ? labels.removeFreeTab : labels.addFreeTab}
            </button>
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
          <button type="button" onClick={resetSelected}>
            {labels.reset}
          </button>
        </div>
      ) : (
        <p className="field-help">{labels.selectPrompt}</p>
      )}
      <p className="field-help">{labels.legend}</p>
    </section>
  );
}
