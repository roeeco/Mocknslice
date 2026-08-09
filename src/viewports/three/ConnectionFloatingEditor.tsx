import type {
  BoundaryGlueTab,
  ConnectionClosure,
  EditableAssemblyEdge,
  FoldingConnectionTreatment,
  PanelConnectionTreatment,
} from '../../domain/connections';
import type { PanelConnectionKey } from '../../domain/panelConstruction';
import { copy } from '../../locales';
import { useProjectStore } from '../../state/useProjectStore';

function shortPanelName(id: string, names: Map<string, string>): string {
  return (names.get(id) ?? id.replace(/^construction-panel-/, '')).replace(/ panel$/i, '');
}

export function ConnectionFloatingEditor({
  mode,
  edge,
}: {
  mode: 'panel-construction' | 'fold-template';
  edge: EditableAssemblyEdge;
}) {
  const project = useProjectStore((state) => state.project);
  const updatePanel = useProjectStore((state) => state.updatePanelComposerSettings);
  const updateFold = useProjectStore((state) => state.updateFoldTemplateSettings);
  const labels = copy.connectionInspector;
  const result =
    mode === 'panel-construction' ? project.panelConstructionResult : project.foldingResult;
  const names = new Map(
    (result?.assembledPreview.panels ?? []).map((panel) => [panel.id, panel.name]),
  );
  const panelSettings = project.modeSettings.panelConstruction;
  const foldSettings = project.modeSettings.foldTemplate;
  const panelOverride =
    mode === 'panel-construction' && edge.kind === 'connection'
      ? panelSettings.connectionOverrides[edge.id as PanelConnectionKey]
      : undefined;
  const panelTreatment = panelOverride?.treatment ?? panelSettings.jointKind;
  const foldConnection =
    mode === 'fold-template' && edge.kind === 'connection'
      ? project.foldingResult?.connections.find((connection) => connection.id === edge.id)
      : undefined;
  const foldOverride =
    mode === 'fold-template' && edge.kind === 'connection'
      ? foldSettings.connectionOverrides.find(
          (override) =>
            override.templateKind === foldSettings.templateKind &&
            override.connectionId === edge.id,
        )
      : undefined;
  const foldTreatment =
    foldOverride?.treatment ?? (foldConnection?.disposition === 'hinge' ? 'crease' : 'cut');

  const setPanelTreatment = (treatment: PanelConnectionTreatment) => {
    if (edge.kind !== 'connection') return;
    updatePanel({
      connectionOverrides: {
        ...panelSettings.connectionOverrides,
        [edge.id]: {
          treatment,
          ...(treatment === 'finger' && panelOverride?.clearanceMm !== undefined
            ? { clearanceMm: panelOverride.clearanceMm }
            : {}),
          ...(treatment === 'butt' && panelOverride?.glueTabOwnerPanelId
            ? { glueTabOwnerPanelId: panelOverride.glueTabOwnerPanelId }
            : {}),
        },
      },
    });
  };

  const setPanelTabOwner = (ownerPanelId?: string) => {
    if (edge.kind !== 'connection') return;
    updatePanel({
      connectionOverrides: {
        ...panelSettings.connectionOverrides,
        [edge.id]: {
          treatment: 'butt',
          ...(ownerPanelId ? { glueTabOwnerPanelId: ownerPanelId } : {}),
        },
      },
    });
  };

  const replaceFoldOverride = (patch: {
    treatment?: FoldingConnectionTreatment;
    closure?: ConnectionClosure;
    tabOwnerPanelId?: string;
    removeOwner?: boolean;
  }) => {
    if (edge.kind !== 'connection') return;
    const existingIndex = foldSettings.connectionOverrides.findIndex(
      (override) =>
        override.templateKind === foldSettings.templateKind && override.connectionId === edge.id,
    );
    const existing =
      existingIndex >= 0 ? foldSettings.connectionOverrides[existingIndex] : undefined;
    const treatment = patch.treatment ?? existing?.treatment ?? foldTreatment;
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
      id: existing?.id ?? `fold-override-${foldSettings.templateKind}-${edge.id}`,
      templateKind: foldSettings.templateKind,
      connectionId: edge.id,
      treatment,
      closure,
      ...(tabOwnerPanelId ? { tabOwnerPanelId } : {}),
    };
    const connectionOverrides = [...foldSettings.connectionOverrides];
    if (existingIndex >= 0) connectionOverrides[existingIndex] = next;
    else connectionOverrides.push(next);
    updateFold({ connectionOverrides });
  };

  const boundaryEnabled =
    mode === 'panel-construction'
      ? panelSettings.boundaryGlueTabs.some((tab) => tab.edgeId === edge.id)
      : foldSettings.boundaryGlueTabs.some(
          (tab) => tab.templateKind === foldSettings.templateKind && tab.edgeId === edge.id,
        );

  const toggleBoundaryTab = () => {
    if (edge.kind !== 'boundary') return;
    if (mode === 'panel-construction') {
      const retained = panelSettings.boundaryGlueTabs.filter((tab) => tab.edgeId !== edge.id);
      updatePanel({
        boundaryGlueTabs: boundaryEnabled
          ? retained
          : [
              ...retained,
              {
                id: `panel-boundary-tab-${edge.id}`,
                ownerPanelId: edge.panelAId,
                edgeId: edge.id,
              },
            ],
      });
      return;
    }
    const retained = foldSettings.boundaryGlueTabs.filter(
      (tab) => tab.templateKind !== foldSettings.templateKind || tab.edgeId !== edge.id,
    );
    const record: BoundaryGlueTab = {
      id: `fold-boundary-tab-${foldSettings.templateKind}-${edge.id}`,
      templateKind: foldSettings.templateKind,
      ownerPanelId: edge.panelAId,
      edgeId: edge.id,
    };
    updateFold({ boundaryGlueTabs: boundaryEnabled ? retained : [...retained, record] });
  };

  const reset = () => {
    if (mode === 'panel-construction') {
      if (edge.kind === 'connection') {
        const connectionOverrides = { ...panelSettings.connectionOverrides };
        delete connectionOverrides[edge.id as PanelConnectionKey];
        updatePanel({ connectionOverrides });
      } else {
        updatePanel({
          boundaryGlueTabs: panelSettings.boundaryGlueTabs.filter((tab) => tab.edgeId !== edge.id),
        });
      }
      return;
    }
    if (edge.kind === 'connection') {
      updateFold({
        connectionOverrides: foldSettings.connectionOverrides.filter(
          (override) =>
            override.templateKind !== foldSettings.templateKind ||
            override.connectionId !== edge.id,
        ),
      });
    } else {
      updateFold({
        boundaryGlueTabs: foldSettings.boundaryGlueTabs.filter(
          (tab) => tab.templateKind !== foldSettings.templateKind || tab.edgeId !== edge.id,
        ),
      });
    }
  };

  const edgeName = `${shortPanelName(edge.panelAId, names)}${
    edge.panelBId ? ` ↔ ${shortPanelName(edge.panelBId, names)}` : ` · ${labels.freeEdge}`
  }`;
  return (
    <div
      className="connection-floating-editor"
      role="dialog"
      aria-label={`${labels.edgeTreatment}: ${edgeName}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <strong>{edgeName}</strong>
      {edge.kind === 'connection' && mode === 'panel-construction' ? (
        <>
          <div className="connection-floating-actions" aria-label={labels.edgeTreatment}>
            {(
              [
                ['finger', labels.finger],
                ['butt', labels.butt],
                ['crease', labels.crease],
              ] as const
            ).map(([treatment, label]) => (
              <button
                type="button"
                aria-pressed={panelTreatment === treatment}
                onClick={() => setPanelTreatment(treatment)}
                key={treatment}
              >
                {label}
              </button>
            ))}
          </div>
          {panelTreatment === 'butt' ? (
            <div className="connection-floating-actions" aria-label={labels.glueOwner}>
              <button
                type="button"
                aria-pressed={!panelOverride?.glueTabOwnerPanelId}
                onClick={() => setPanelTabOwner()}
              >
                {labels.none}
              </button>
              {[edge.panelAId, edge.panelBId!].map((panelId) => (
                <button
                  type="button"
                  aria-pressed={panelOverride?.glueTabOwnerPanelId === panelId}
                  onClick={() => setPanelTabOwner(panelId)}
                  key={panelId}
                >
                  {labels.glueTab}: {shortPanelName(panelId, names)}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
      {edge.kind === 'connection' && mode === 'fold-template' ? (
        <>
          <div className="connection-floating-actions" aria-label={labels.edgeTreatment}>
            {(
              [
                ['crease', labels.crease],
                ['cut', labels.cut],
              ] as const
            ).map(([treatment, label]) => (
              <button
                type="button"
                aria-pressed={foldTreatment === treatment}
                onClick={() => replaceFoldOverride({ treatment })}
                key={treatment}
              >
                {label}
              </button>
            ))}
          </div>
          {foldTreatment === 'cut' ? (
            <>
              <div className="connection-floating-actions" aria-label={labels.closure}>
                {(
                  [
                    ['none', labels.none],
                    ['glue-tab', labels.glueTab],
                    ['press-fit', labels.pressFit],
                  ] as const
                ).map(([closure, label]) => (
                  <button
                    type="button"
                    aria-pressed={(foldOverride?.closure ?? 'none') === closure}
                    onClick={() => replaceFoldOverride({ closure })}
                    key={closure}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {(foldOverride?.closure === 'glue-tab' || foldOverride?.closure === 'press-fit') &&
              edge.panelBId ? (
                <div className="connection-floating-actions" aria-label={labels.tabOwner}>
                  {[edge.panelAId, edge.panelBId].map((panelId) => (
                    <button
                      type="button"
                      aria-pressed={foldOverride?.tabOwnerPanelId === panelId}
                      onClick={() => replaceFoldOverride({ tabOwnerPanelId: panelId })}
                      key={panelId}
                    >
                      {shortPanelName(panelId, names)}
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
      {edge.kind === 'boundary' ? (
        <button type="button" disabled={!edge.editable} onClick={toggleBoundaryTab}>
          {boundaryEnabled ? labels.removeFreeTab : labels.addFreeTab}
        </button>
      ) : null}
      <button className="connection-reset-action" type="button" onClick={reset}>
        {labels.reset}
      </button>
    </div>
  );
}
