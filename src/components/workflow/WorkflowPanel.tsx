import { registeredLegacyKinds } from '../../templates/definitions';
import { useRef, useState, type ChangeEvent } from 'react';
import { deriveAssemblyInspection } from '../../domain/assembly';
import { deriveGenerationState } from '../../domain/generation';
import { measureConnectionAlignment } from '../../geometry/folding/measureConnectionAlignment';
import { createProjectDownload } from '../../exporters/exportProject';
import { parseProjectFile, ProjectImportError } from '../../exporters/importProject';
import { copy, materialLabel, t } from '../../locales';
import { useProjectStore } from '../../state/useProjectStore';
import type { WorkflowStep } from '../../state/types';
import { deriveWorkflowGate, visibleWorkflowSteps, workflowStepIndex } from '../../state/workflow';
import { FabricationOutputPanel } from '../panels/FabricationOutputPanel';
import { FoldTemplatePanel } from '../panels/FoldTemplatePanel';
import { LayoutPanel } from '../panels/LayoutPanel';
import { MeshUnfoldPanel } from '../panels/MeshUnfoldPanel';
import { ModelImportPanel } from '../panels/ModelImportPanel';
import { ModelInspectionPanel } from '../panels/ModelInspectionPanel';
import { PanelConstructionPanel } from '../panels/PanelConstructionPanel';
import { StackedSlicePanel } from '../panels/StackedSlicePanel';
import { WaffleSlicePanel } from '../panels/WaffleSlicePanel';
import { WarningPanel } from '../panels/WarningPanel';
import { AdvancedSettingsSection } from '../panels/AdvancedSettingsSection';
import { PanelComposer } from '../panels/panelComposer/PanelComposer';
import { RuntimeFailureMessage } from '../RuntimeFailureMessage';
import {
  runtimeFailure,
  runtimeFailureMessage,
  type RuntimeFailure,
} from '../../domain/runtimeFailure';
import { ModeIcon, type ModeChoice } from './ModeIcon';
import { SourceChoiceIcon, TemplateChoiceIcon } from './TemplateChoiceIcon';

function StartStep() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<RuntimeFailure>();
  const project = useProjectStore((state) => state.project);
  const locale = useProjectStore((state) => state.locale);
  const renameProject = useProjectStore((state) => state.renameProject);
  const createNewProject = useProjectStore((state) => state.createNewProject);
  const replaceProject = useProjectStore((state) => state.replaceProject);

  const importProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      replaceProject(parseProjectFile(await file.text()));
      setError(undefined);
    } catch (caught) {
      setError(
        runtimeFailure(
          'PROJECT_IMPORT_FAILED',
          caught instanceof ProjectImportError
            ? caught.message
            : 'The project could not be imported.',
        ),
      );
    }
  };

  return (
    <section className="panel-section workflow-step-panel" aria-labelledby="start-step-heading">
      <h2 id="start-step-heading">{copy.startProject}</h2>
      <div className="field-stack">
        <label htmlFor="project-name">{copy.projectName}</label>
        <input
          id="project-name"
          value={project.metadata.name}
          onChange={(event) => renameProject(event.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="project-start-actions">
        <button
          type="button"
          onClick={() => {
            if (window.confirm(copy.newProjectConfirmation)) createNewProject();
          }}
        >
          {copy.newProject}
        </button>
        <button type="button" onClick={() => inputRef.current?.click()}>
          {copy.importProject}
        </button>
      </div>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept="application/json,.json"
        aria-label={t('Choose a MocknSlice project file')}
        onChange={(event) => void importProject(event)}
      />
      {error ? (
        <p className="inline-error" role="alert">
          {runtimeFailureMessage(error, locale)}
        </p>
      ) : null}
      <div className="local-first-card">
        <strong>{copy.localFirst}</strong>
        <p>{copy.localFirstBody}</p>
      </div>
    </section>
  );
}

function ModeStep() {
  const mode = useProjectStore((state) => state.project.fabricationMode);
  const setMode = useProjectStore((state) => state.setFabricationMode);
  const modes: { id: ModeChoice; label: string }[] = [
    { id: 'stacked-slices', label: copy.modes['stacked-slices'] },
    { id: 'waffle-slices', label: copy.modes['waffle-slices'] },
    { id: 'folding', label: copy.foldingAndUnfolding },
    { id: 'panel-construction', label: copy.modes['panel-construction'] },
  ];
  const selectedMode: ModeChoice =
    mode === 'fold-template' || mode === 'mesh-unfold' ? 'folding' : mode;
  return (
    <section className="panel-section workflow-step-panel" aria-labelledby="mode-step-heading">
      <h2 id="mode-step-heading">{copy.chooseMode}</h2>
      <div className="mode-choice-list" role="radiogroup" aria-label={copy.fabricationMode}>
        {modes.map(({ id, label }) => (
          <label
            className={selectedMode === id ? 'mode-choice is-selected' : 'mode-choice'}
            key={id}
          >
            <input
              type="radio"
              name="fabrication-mode"
              value={id}
              checked={selectedMode === id}
              onChange={() => setMode(id === 'folding' ? 'mesh-unfold' : id)}
            />
            <ModeIcon mode={id} />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

function ImportOrCreateStep() {
  const project = useProjectStore((state) => state.project);
  const setWorkflowSourceMode = useProjectStore((state) => state.setWorkflowSourceMode);
  const selectTemplateSource = useProjectStore((state) => state.selectTemplateSource);
  const sourceMode = project.fabricationMode === 'fold-template' ? 'template' : 'import';
  const selectedTemplate = project.modeSettings.foldTemplate.templateKind;

  return (
    <>
      <section
        className="panel-section workflow-step-panel source-choice-panel"
        aria-labelledby="source-choice-heading"
      >
        <h2 id="source-choice-heading">{copy.sourceChoice}</h2>
        <div className="source-choice-list" role="group" aria-label={copy.sourceChoice}>
          <button
            type="button"
            className={sourceMode === 'import' ? 'source-choice is-selected' : 'source-choice'}
            aria-label={copy.importModel}
            aria-pressed={sourceMode === 'import'}
            onClick={() => setWorkflowSourceMode('import')}
          >
            <SourceChoiceIcon kind="import" />
            <span>
              <strong>{copy.importModel}</strong>
              <small>{copy.importModelDescription}</small>
            </span>
          </button>
          <button
            type="button"
            className={sourceMode === 'template' ? 'source-choice is-selected' : 'source-choice'}
            aria-label={copy.createTemplate}
            aria-pressed={sourceMode === 'template'}
            onClick={() => setWorkflowSourceMode('template')}
          >
            <SourceChoiceIcon kind="template" />
            <span>
              <strong>{copy.createTemplate}</strong>
              <small>{copy.createTemplateDescription}</small>
            </span>
          </button>
        </div>
        {sourceMode === 'template' ? (
          <div className="template-source-options">
            <h3>{copy.chooseTemplate}</h3>
            <div className="template-choice-grid" role="group" aria-label={copy.templateFamily}>
              {registeredLegacyKinds.map((templateKind) => (
                <button
                  type="button"
                  className={
                    selectedTemplate === templateKind
                      ? 'template-choice is-selected'
                      : 'template-choice'
                  }
                  aria-label={copy.templateNames[templateKind]}
                  aria-pressed={selectedTemplate === templateKind}
                  onClick={() => selectTemplateSource(templateKind)}
                  key={templateKind}
                >
                  <TemplateChoiceIcon kind={templateKind} />
                  <span>{copy.templateNames[templateKind]}</span>
                </button>
              ))}
            </div>
            <p className="field-help template-dimensions-note">{copy.templateDimensionsNext}</p>
          </div>
        ) : null}
      </section>
      {sourceMode === 'import' ? (
        <>
          <ModelImportPanel />
          {project.model.source.kind === 'imported' ? (
            <ModelInspectionPanel mode="controls" />
          ) : null}
        </>
      ) : null}
    </>
  );
}

function MaterialControls() {
  const project = useProjectStore((state) => state.project);
  const experienceMode = useProjectStore((state) => state.experienceMode);
  const materials = useProjectStore((state) => state.materials);
  const selectMaterial = useProjectStore((state) => state.selectMaterial);
  const updateCustomMaterial = useProjectStore((state) => state.updateCustomMaterial);
  const selected = project.materialProfileSnapshot;
  const updateNumber = (key: keyof typeof selected, value: number) =>
    updateCustomMaterial({ [key]: Number.isFinite(value) ? Math.max(0, value) : 0 });
  return (
    <section className="panel-section compact-setup" aria-labelledby="material-heading">
      <p className="eyebrow">{copy.material}</p>
      <h2 id="material-heading">{copy.materialStock}</h2>
      <div className="field-stack">
        <label htmlFor="material-profile">{copy.material}</label>
        <select
          id="material-profile"
          value={project.materialProfileSnapshot.id}
          onChange={(event) => selectMaterial(event.target.value)}
        >
          {materials.map((material) => (
            <option key={material.id} value={material.id}>
              {materialLabel(material.id, material.name)}
            </option>
          ))}
        </select>
      </div>
      {selected.id === 'custom-material' ? (
        <fieldset className="custom-material-fields">
          <legend>{copy.customMaterial}</legend>
          <div className="field-stack">
            <label htmlFor="custom-material-name">{copy.materialName}</label>
            <input
              id="custom-material-name"
              value={selected.name}
              onChange={(event) => updateCustomMaterial({ name: event.target.value })}
            />
          </div>
          <div className="field-stack">
            <label htmlFor="custom-thickness">{copy.thickness} (mm)</label>
            <input
              id="custom-thickness"
              type="number"
              min="0"
              step="0.01"
              value={selected.thicknessMm}
              onChange={(event) => updateNumber('thicknessMm', event.target.valueAsNumber)}
            />
          </div>
          {experienceMode === 'advanced' ? (
            <AdvancedSettingsSection>
              <div className="form-grid two-column-grid">
                <div className="field-stack">
                  <label htmlFor="custom-kerf">{copy.kerf} (mm)</label>
                  <input
                    id="custom-kerf"
                    type="number"
                    min="0"
                    step="0.01"
                    value={selected.kerfMm}
                    onChange={(event) => updateNumber('kerfMm', event.target.valueAsNumber)}
                  />
                </div>
                <div className="field-stack">
                  <label htmlFor="custom-clearance">{copy.clearance} (mm)</label>
                  <input
                    id="custom-clearance"
                    type="number"
                    min="0"
                    step="0.01"
                    value={selected.clearanceMm}
                    onChange={(event) => updateNumber('clearanceMm', event.target.valueAsNumber)}
                  />
                </div>
              </div>
              <div className="form-grid two-column-grid">
                <div className="field-stack">
                  <label htmlFor="custom-sheet-width">{copy.defaultSheetWidth} (mm)</label>
                  <input
                    id="custom-sheet-width"
                    type="number"
                    min="1"
                    step="1"
                    value={selected.defaultSheetWidthMm}
                    onChange={(event) =>
                      updateNumber('defaultSheetWidthMm', event.target.valueAsNumber)
                    }
                  />
                </div>
                <div className="field-stack">
                  <label htmlFor="custom-sheet-height">{copy.defaultSheetHeight} (mm)</label>
                  <input
                    id="custom-sheet-height"
                    type="number"
                    min="1"
                    step="1"
                    value={selected.defaultSheetHeightMm}
                    onChange={(event) =>
                      updateNumber('defaultSheetHeightMm', event.target.valueAsNumber)
                    }
                  />
                </div>
              </div>
            </AdvancedSettingsSection>
          ) : null}
        </fieldset>
      ) : (
        <>
          {experienceMode === 'advanced' ? (
            <AdvancedSettingsSection>
              <p className="material-inline-summary">
                {selected.thicknessMm} mm · {selected.kerfMm} mm {copy.kerf} ·{' '}
                {selected.clearanceMm} mm {copy.clearance}
              </p>
              <p className="material-inline-summary">
                {selected.defaultSheetWidthMm} × {selected.defaultSheetHeightMm} mm
              </p>
            </AdvancedSettingsSection>
          ) : null}
        </>
      )}
    </section>
  );
}

function ConfigureStep() {
  const mode = useProjectStore((state) => state.project.fabricationMode);
  return (
    <>
      {mode !== 'panel-construction' ? <MaterialControls /> : null}
      {mode === 'stacked-slices' ? <StackedSlicePanel hideGenerationAction /> : null}
      {mode === 'waffle-slices' ? <WaffleSlicePanel hideGenerationAction /> : null}
      {mode === 'fold-template' ? <FoldTemplatePanel hideGenerationAction /> : null}
      {mode === 'mesh-unfold' ? <MeshUnfoldPanel hideGenerationAction /> : null}
      {mode === 'panel-construction' ? (
        <>
          <PanelConstructionPanel hideGenerationAction />
          <PanelComposer />
        </>
      ) : null}
    </>
  );
}

function InspectStep() {
  const project = useProjectStore((state) => state.project);
  const generationError = useProjectStore((state) => state.sliceGenerationError);
  const progress = useProjectStore((state) => state.foldPreviewProgress);
  const setProgress = useProjectStore((state) => state.setFoldPreviewProgress);
  const assembly = deriveAssemblyInspection(project);
  const alignment = project.foldingResult
    ? measureConnectionAlignment(
        project.foldingResult.panels,
        project.foldingResult.assembledPreview.panels,
        project.foldingResult.connections,
      )
    : undefined;
  const hasAssembly = assembly.order.length > 0;
  return (
    <>
      <section className="panel-section workflow-step-panel" aria-labelledby="inspect-step-heading">
        <h2 id="inspect-step-heading">{copy.inspectParts}</h2>
        <p className="generation-result-summary">
          <strong>{project.generatedParts.length}</strong>{' '}
          {project.generatedParts.length === 1
            ? copy.fabricationPartGenerated
            : copy.fabricationPartsGenerated}
        </p>
        {generationError ? (
          <p className="inline-error" role="alert">
            <RuntimeFailureMessage failure={generationError} />
          </p>
        ) : null}
        {project.unfoldingResult ? (
          <div className="field-stack unfold-progress">
            <div className="panel-heading-row">
              <label htmlFor="inspect-fold-progress">{copy.foldingPreview}</label>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <input
              id="inspect-fold-progress"
              type="range"
              min={0}
              max={100}
              value={Math.round(progress * 100)}
              onChange={(event) => setProgress(event.target.valueAsNumber / 100)}
            />
          </div>
        ) : null}
        {hasAssembly ? (
          <div className="assembly-inspection" data-testid="assembly-inspection">
            <dl className="assembly-metrics">
              <div>
                <dt>{copy.joins}</dt>
                <dd>
                  {assembly.resolvedJoinCount}/{assembly.requiredJoinCount} {copy.resolved}
                </dd>
              </div>
              <div>
                <dt>{copy.hinges}</dt>
                <dd>{assembly.hingeCount}</dd>
              </div>
              <div>
                <dt>{copy.seams}</dt>
                <dd>{assembly.seamCount}</dd>
              </div>
              <div>
                <dt>{copy.glueTabs}</dt>
                <dd>{assembly.glueTabCount}</dd>
              </div>
              <div>
                <dt>{copy.tabCollisions}</dt>
                <dd>{assembly.tabCollisionCount}</dd>
              </div>
              {alignment ? (
                <div>
                  <dt>{copy.receiverAlignment}</dt>
                  <dd>{alignment.maximumEndpointErrorMm.toFixed(3)} mm</dd>
                </div>
              ) : null}
              <div>
                <dt>{copy.result}</dt>
                <dd>{copy.generationState[assembly.generationState]}</dd>
              </div>
            </dl>
            {assembly.missingJoinCount > 0 ? (
              <p className="inline-error" role="alert">
                {copy.missingJoins(assembly.missingJoinCount)}
              </p>
            ) : null}
            <p className="field-help">
              {copy.assemblyOrder(assembly.hingeCount, assembly.seamCount)}
            </p>
          </div>
        ) : null}
      </section>
      <ModelInspectionPanel mode="health" />
      <WarningPanel />
    </>
  );
}

function ExportStep() {
  const project = useProjectStore((state) => state.project);
  return (
    <>
      <FabricationOutputPanel />
      <section className="panel-section project-file-export">
        <h2>{copy.projectFile}</h2>
        <p className="field-help">{copy.projectFileBody}</p>
        <button type="button" onClick={() => createProjectDownload(project)}>
          {copy.exportProject}
        </button>
      </section>
    </>
  );
}

function StepContents({ step }: { step: WorkflowStep }) {
  const project = useProjectStore((state) => state.project);
  const mode = project.fabricationMode;
  if (step === 'start') return <StartStep />;
  if (step === 'mode') return <ModeStep />;
  if (step === 'import') {
    if (mode === 'panel-construction') {
      return (
        <section className="panel-section workflow-step-panel">
          <h2>{copy.noSourceModel}</h2>
          <p className="field-help">{copy.noSourceModelBody}</p>
        </section>
      );
    }
    if (mode === 'fold-template' || mode === 'mesh-unfold') return <ImportOrCreateStep />;
    return (
      <>
        <ModelImportPanel />
        {project.model.source.kind === 'imported' ? <ModelInspectionPanel mode="controls" /> : null}
      </>
    );
  }
  if (step === 'configure') return <ConfigureStep />;
  if (step === 'inspect') return <InspectStep />;
  if (step === 'arrange') return <LayoutPanel />;
  return <ExportStep />;
}

export function WorkflowPanel() {
  const active = useProjectStore((state) => state.activeWorkflowStep);
  const project = useProjectStore((state) => state.project);
  const status = useProjectStore((state) => state.sliceGenerationStatus);
  const experienceMode = useProjectStore((state) => state.experienceMode);
  const completed = useProjectStore((state) => state.completedWorkflowSteps);
  const complete = useProjectStore((state) => state.completeWorkflowStep);
  const setStep = useProjectStore((state) => state.setActiveWorkflowStep);
  const setViewport = useProjectStore((state) => state.setViewportMode);
  const generateSlices = useProjectStore((state) => state.generateSlices);
  const generateWaffle = useProjectStore((state) => state.generateWaffleSlices);
  const generateFold = useProjectStore((state) => state.generateFoldTemplate);
  const generateUnfold = useProjectStore((state) => state.generateMeshUnfold);
  const generatePanels = useProjectStore((state) => state.generatePanelConstruction);
  const cancel = useProjectStore((state) => state.cancelSliceGeneration);

  const steps = visibleWorkflowSteps(project, experienceMode, status);
  const index = workflowStepIndex(active, steps);
  const gate = deriveWorkflowGate(project, { activeStep: active, generationStatus: status });
  const canAdvance = gate.allowed;
  const generationState = deriveGenerationState(project);
  const hasBlockingError =
    status === 'error' ||
    (project.generationIssues ?? []).some((issue) => issue.severity === 'error');
  const canLeaveConfigure = generationState === 'ready' || hasBlockingError;

  const go = (step: WorkflowStep) => {
    setStep(step);
    setViewport(step === 'arrange' || step === 'export' ? 'two' : 'three');
  };
  const previous = index > 0 ? steps[index - 1] : undefined;
  const next = index < steps.length - 1 ? steps[index + 1] : undefined;
  const generate = () => {
    if (!gate.allowed) return;
    if (project.fabricationMode === 'stacked-slices') generateSlices();
    else if (project.fabricationMode === 'waffle-slices') generateWaffle();
    else if (project.fabricationMode === 'fold-template') generateFold();
    else if (project.fabricationMode === 'mesh-unfold') generateUnfold();
    else generatePanels();
  };
  const advance = () => {
    if (!canAdvance || (active === 'configure' && !canLeaveConfigure)) return;
    complete(active);
    if (next) go(next);
  };

  return (
    <div className="workflow-panel-shell">
      <div className="workflow-panel-content">
        <StepContents step={active} />
      </div>
      <footer className="workflow-footer">
        <button type="button" disabled={!previous} onClick={() => previous && go(previous)}>
          {copy.previous}
        </button>
        {active === 'configure' && status === 'processing' ? (
          <button type="button" onClick={cancel}>
            {copy.cancelGenerationLong}
          </button>
        ) : active === 'configure' ? (
          <>
            <button
              className="primary-panel-action"
              type="button"
              disabled={!gate.allowed}
              onClick={generate}
            >
              {generationState === 'absent' ? copy.generate : copy.regenerate}
            </button>
            <button type="button" disabled={!canLeaveConfigure} onClick={advance}>
              {hasBlockingError ? copy.reviewErrors : copy.next}
            </button>
          </>
        ) : active !== 'export' ? (
          <button
            className="primary-panel-action"
            type="button"
            disabled={!canAdvance}
            onClick={advance}
          >
            {copy.next}
          </button>
        ) : null}
        {active === 'configure' && !canLeaveConfigure && status !== 'processing' ? (
          <p className="field-help" role="status">
            {copy.generateBeforeContinuing}
          </p>
        ) : !canAdvance && gate.reasons.length > 0 ? (
          <p className="field-help" role="status">
            {gate.reasons.map((reason) => copy.workflowReasons[reason]).join(' ')}
          </p>
        ) : null}
      </footer>
      <span className="visually-hidden" aria-live="polite">
        {completed.length} {copy.workflowComplete}
      </span>
    </div>
  );
}
