import { useState } from 'react';
import { hashSerializable } from '../../../domain/canonicalHash';
import type { PanelFeature, PanelFeatureTargetRole } from '../../../domain/modeSettings';
import { copy } from '../../../locales';
import { useProjectStore } from '../../../state/useProjectStore';
import { IssueList } from '../WarningPanel';
import { PanelFeatureInspector } from './PanelFeatureInspector';
import { PanelFeatureToolbar } from './PanelFeatureToolbar';
import { PanelLocalPreview } from './PanelLocalPreview';
import { PanelSelector } from './PanelSelector';

function resultMatchesPanelShell(
  project: ReturnType<typeof useProjectStore.getState>['project'],
): boolean {
  const result = project.panelConstructionResult;
  if (!result) return false;
  const settings = project.modeSettings.panelConstruction;
  const material = project.materialProfileSnapshot;
  return (
    result.settings.innerWidthMm === settings.innerWidthMm &&
    result.settings.innerDepthMm === settings.innerDepthMm &&
    result.settings.innerHeightMm === settings.innerHeightMm &&
    result.settings.jointKind === settings.jointKind &&
    result.settings.fingerWidthMm === settings.fingerWidthMm &&
    result.settings.clearanceMm === settings.clearanceMm &&
    result.settings.includeLid === settings.includeLid &&
    (result.settings.panelThicknessMm ?? result.material.thicknessMm) ===
      settings.panelThicknessMm &&
    (result.settings.dividerThicknessMm ?? result.material.thicknessMm) ===
      settings.dividerThicknessMm &&
    (result.settings.lidThicknessMm ?? result.material.thicknessMm) === settings.lidThicknessMm &&
    (result.settings.widthDividerCount ?? 0) === settings.widthDividerCount &&
    (result.settings.depthDividerCount ?? 0) === settings.depthDividerCount &&
    hashSerializable(result.settings.connectionOverrides ?? {}) ===
      hashSerializable(settings.connectionOverrides) &&
    hashSerializable(result.settings.panelProfiles ?? { front: 'flat', back: 'flat' }) ===
      hashSerializable(settings.panelProfiles) &&
    result.material.id === material.id &&
    result.material.category === material.category &&
    result.material.thicknessMm === settings.panelThicknessMm &&
    result.material.kerfMm === material.kerfMm
  );
}

function featureId(): string {
  return `panel-feature-${crypto.randomUUID()}`;
}

function roleFromPartId(partId: string | undefined): PanelFeatureTargetRole | undefined {
  const role = partId?.replace('construction-part-', '');
  return ['base', 'front', 'back', 'left', 'right', 'lid'].includes(role ?? '')
    ? (role as PanelFeatureTargetRole)
    : undefined;
}

export function PanelComposer() {
  const project = useProjectStore((state) => state.project);
  const experienceMode = useProjectStore((state) => state.experienceMode);
  const selectedEntityId = useProjectStore((state) => state.selectedEntityId);
  const selectedPartId = useProjectStore((state) => state.selectedPartId);
  const validationIssues = useProjectStore((state) => state.validationIssues);
  const selectEntity = useProjectStore((state) => state.selectEntity);
  const addPanelFeature = useProjectStore((state) => state.addPanelFeature);
  const updatePanelFeature = useProjectStore((state) => state.updatePanelFeature);
  const duplicatePanelFeature = useProjectStore((state) => state.duplicatePanelFeature);
  const removePanelFeature = useProjectStore((state) => state.removePanelFeature);
  const settings = project.modeSettings.panelConstruction;
  const selectedFeature = settings.features.find((feature) => feature.id === selectedEntityId);
  const [requestedPanelRole, setRequestedPanelRole] = useState<PanelFeatureTargetRole>(
    selectedFeature?.targetRole ?? roleFromPartId(selectedPartId) ?? 'front',
  );
  const selectedPanelRole = roleFromPartId(selectedPartId);
  const candidatePanelRole = selectedFeature?.targetRole ?? selectedPanelRole ?? requestedPanelRole;
  const panelRole =
    candidatePanelRole === 'lid' && !settings.includeLid ? 'front' : candidatePanelRole;

  const selectPanel = (role: PanelFeatureTargetRole) => {
    setRequestedPanelRole(role);
    selectEntity(`construction-panel-${role}`, `construction-part-${role}`);
  };
  const selectFeature = (feature: PanelFeature) => {
    setRequestedPanelRole(feature.targetRole);
    selectEntity(feature.id, `construction-part-${feature.targetRole}`);
  };
  const add = (kind: PanelFeature['kind']) => {
    const id = featureId();
    const common = {
      id,
      targetRole: panelRole,
      anchor: { u: 0.5, v: 0.5 },
      rotationDeg: 0,
    };
    const feature: PanelFeature =
      kind === 'rectangular-cutout'
        ? { ...common, kind, widthMm: 30, heightMm: 15, purpose: copy.panelComposer.opening }
        : kind === 'circular-cutout'
          ? { ...common, kind, diameterMm: 20, purpose: copy.panelComposer.opening }
          : {
              ...common,
              kind,
              text: copy.panelComposer.defaultLabel,
              fontSizeMm: 4,
              purpose: copy.panelComposer.label,
            };
    addPanelFeature(feature);
    selectFeature(feature);
  };
  const change = (feature: PanelFeature) => {
    updatePanelFeature(feature.id, feature);
    selectFeature(feature);
  };
  const remove = (feature: PanelFeature) => {
    removePanelFeature(feature.id);
    selectPanel(feature.targetRole);
  };
  const duplicate = (feature: PanelFeature) => {
    const id = featureId();
    duplicatePanelFeature(feature.id, id);
    const duplicateFeature = {
      ...structuredClone(feature),
      id,
      offsetMm: {
        x: (feature.offsetMm?.x ?? 0) + 5,
        y: (feature.offsetMm?.y ?? 0) - 5,
      },
    };
    selectFeature(duplicateFeature);
  };
  const exactPanel = resultMatchesPanelShell(project)
    ? project.panelConstructionResult?.panels.find((panel) => panel.role === panelRole)
    : undefined;
  const selectedIssues = selectedFeature
    ? validationIssues.filter((issue) => issue.affectedEntityIds.includes(selectedFeature.id))
    : [];
  const featuresNeedRegeneration = Boolean(
    settings.features.length > 0 &&
    (!project.panelConstructionResult ||
      hashSerializable(project.panelConstructionResult.settings.features ?? []) !==
        hashSerializable(settings.features)),
  );

  return (
    <details className="panel-section panel-composer" aria-labelledby="panel-composer-heading">
      <summary id="panel-composer-heading">{copy.panelComposer.heading}</summary>
      <div className="panel-composer-body">
        <p className="field-help">{copy.panelComposer.intro}</p>
        <PanelSelector
          selected={panelRole}
          includeLid={settings.includeLid}
          onSelect={selectPanel}
        />
        <PanelFeatureToolbar onAdd={add} />
        {featuresNeedRegeneration ? (
          <p className="manual-regeneration-notice" role="status">
            {copy.panelComposer.regenerateNotice}
          </p>
        ) : null}
        <PanelLocalPreview
          settings={settings}
          panelRole={panelRole}
          {...(exactPanel ? { exactPanel } : {})}
          {...(selectedFeature ? { selectedFeatureId: selectedFeature.id } : {})}
          onSelectFeature={selectFeature}
          onCommitFeature={change}
        />
        <div className="panel-feature-list" aria-label={copy.panelComposer.featureList}>
          {settings.features.filter((feature) => feature.targetRole === panelRole).length === 0 ? (
            <p className="field-help">{copy.panelComposer.noFeatures}</p>
          ) : (
            settings.features
              .filter((feature) => feature.targetRole === panelRole)
              .map((feature) => (
                <button
                  key={feature.id}
                  type="button"
                  aria-pressed={feature.id === selectedFeature?.id}
                  onClick={() => selectFeature(feature)}
                >
                  {feature.purpose ||
                    (feature.kind === 'engraved-label' ? feature.text : copy.panelComposer.opening)}
                </button>
              ))
          )}
        </div>
        {selectedFeature ? (
          <PanelFeatureInspector
            feature={selectedFeature}
            settings={settings}
            experienceMode={experienceMode}
            onChange={change}
            onDuplicate={() => duplicate(selectedFeature)}
            onDelete={() => remove(selectedFeature)}
          />
        ) : null}
        {selectedIssues.length > 0 ? (
          <div className="panel-feature-issues" aria-label={copy.panelComposer.featureIssues}>
            <IssueList issues={selectedIssues} />
          </div>
        ) : null}
      </div>
    </details>
  );
}
