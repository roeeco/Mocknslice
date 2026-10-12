import { useEffect, useState, type PropsWithChildren } from 'react';
import { AppHeader } from '../../app/layout/AppHeader';
import { useProjectStore } from '../../state/useProjectStore';
import { studioCopy } from '../../locales/studioCopy';
import { TemplateCatalog } from '../templates/TemplateCatalog';
import { TemplateInspector } from '../templates/TemplateInspector';
import { ModelImportPanel } from '../panels/ModelImportPanel';
import { ModelInspectionPanel } from '../panels/ModelInspectionPanel';
import { PanelConstructionPanel } from '../panels/PanelConstructionPanel';
import { StackedSlicePanel } from '../panels/StackedSlicePanel';
import { WaffleSlicePanel } from '../panels/WaffleSlicePanel';
import { MeshUnfoldPanel } from '../panels/MeshUnfoldPanel';
import { FabricationOutputPanel } from '../panels/FabricationOutputPanel';
import { LayoutPanel } from '../panels/LayoutPanel';
import { ProjectDrawer } from './ProjectDrawer';
import { ProjectNameField } from './ProjectNameField';
import { PreviewProjectContext } from '../../viewports/PreviewProject';
import { templateDraftPreview } from '../../templates/draftPreview';
import type { FoldTemplateSettings } from '../../domain/modeSettings';
import type { ProjectData } from '../../domain/project';
import { deriveGenerationState } from '../../domain/generation';
import { copy } from '../../locales';

type Destination = 'create' | 'design' | 'manufacture';
export function StudioShell({ children, onLegacy }: PropsWithChildren<{ onLegacy: () => void }>) {
  const project = useProjectStore((state) => state.project),
    locale = useProjectStore((state) => state.locale),
    status = useProjectStore((state) => state.sliceGenerationStatus),
    materialLibrary = useProjectStore((state) => state.materials);
  const experience = useProjectStore((state) => state.experienceMode);
  const setExperience = useProjectStore((state) => state.setExperienceMode);
  const c = studioCopy(locale),
    generation = deriveGenerationState(project),
    [destination, setDestination] = useState<Destination>(
      project.generatedParts.length ? 'design' : 'create',
    ),
    [arrange, setArrange] = useState(false),
    [library, setLibrary] = useState(false),
    [inspectorOpen, setInspectorOpen] = useState(true),
    [draft, setDraft] = useState<Partial<FoldTemplateSettings> | null>(),
    [preview, setPreview] = useState<{ project: ProjectData; source: ProjectData }>();
  const choose = useProjectStore((state) => state.selectTemplateSource),
    setMode = useProjectStore((state) => state.setFabricationMode),
    setMaterial = useProjectStore((state) => state.selectMaterial),
    fit = useProjectStore((state) => state.fitCamera),
    cancel = useProjectStore((state) => state.cancelSliceGeneration);
  useEffect(() => {
    if (!draft || project.fabricationMode !== 'fold-template') return;
    const timer = window.setTimeout(() => {
      try {
        const value = templateDraftPreview(project, draft);
        if (value.project) setPreview({ project: value.project, source: project });
      } catch {
        /* Invalid draft stays local and retains the prior valid preview. */
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [draft, project]);
  const shownPreview = draft && preview?.source === project ? preview.project : undefined;
  const canGenerate =
    project.fabricationMode === 'fold-template' ||
    project.fabricationMode === 'panel-construction' ||
    project.model.source.kind === 'imported';
  const generate = () => {
    const state = useProjectStore.getState();
    if (project.fabricationMode === 'fold-template') state.generateFoldTemplate();
    else if (project.fabricationMode === 'panel-construction') state.generatePanelConstruction();
    else if (project.fabricationMode === 'stacked-slices') state.generateSlices();
    else if (project.fabricationMode === 'waffle-slices') state.generateWaffleSlices();
    else state.generateMeshUnfold();
  };
  const design = () => {
    setDraft(undefined);
    setPreview(undefined);
    setDestination('design');
    setArrange(false);
    setInspectorOpen(true);
  };
  const mode = (value: typeof project.fabricationMode) => {
    cancel();
    setMode(value);
    setDraft(undefined);
    design();
  };
  const materialChanged = (id: string) => {
    setMaterial(id);
    if (project.fabricationMode === 'fold-template')
      useProjectStore.getState().generateFoldTemplate({ mergeWithInputEdit: true });
  };
  return (
    <div className="studio-shell" data-workflow="studio">
      <AppHeader />
      <nav className="studio-navigation" aria-label={c.destinations}>
        {(['create', 'design', 'manufacture'] as const).map((value) => (
          <button
            type="button"
            key={value}
            aria-current={destination === value ? 'page' : undefined}
            onClick={() => {
              setDestination(value);
              setArrange(false);
            }}
            disabled={
              value === 'manufacture' &&
              (draft !== undefined || status === 'processing' || generation === 'absent')
            }
          >
            {c[value]}
          </button>
        ))}
        <span className="studio-nav-spacer" />
        <button
          type="button"
          aria-pressed={experience === 'advanced'}
          onClick={() => setExperience(experience === 'advanced' ? 'standard' : 'advanced')}
        >
          {c.advanced}
        </button>
        <button type="button" onClick={() => setLibrary(true)}>
          {c.projects}
        </button>
        <button type="button" onClick={onLegacy}>
          {c.legacy}
        </button>
      </nav>
      {destination === 'create' ? (
        <main className="studio-create">
          <h1>{c.create}</h1>
          <p>{c.createIntro}</p>
          <div className="create-paths">
            <button
              type="button"
              onClick={() =>
                document.getElementById('catalog-heading')?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              {c.catalog}
            </button>
            <button
              type="button"
              onClick={() => {
                choose('open-box');
                design();
                useProjectStore.getState().generateFoldTemplate({ mergeWithInputEdit: true });
                fit();
              }}
            >
              {c.dimensions}
            </button>
            <button type="button" onClick={() => mode('mesh-unfold')}>
              {c.importModel}
            </button>
            <button type="button" onClick={() => mode('panel-construction')}>
              {c.panels}
            </button>
          </div>
          <TemplateCatalog
            onChoose={(definition) => {
              if (!definition.legacyKind) return;
              cancel();
              choose(definition.legacyKind);
              setDraft(undefined);
              design();
              useProjectStore.getState().generateFoldTemplate({ mergeWithInputEdit: true });
              fit();
            }}
          />
        </main>
      ) : (
        <div className="studio-body">
          <aside
            className={`studio-inspector${inspectorOpen ? ' is-open' : ''}`}
            aria-label={c.design}
          >
            <button
              className="inspector-close"
              type="button"
              onClick={() => setInspectorOpen(false)}
            >
              {c.close}
            </button>
            {destination === 'manufacture' ? (
              <>
                <h1>{c.outputTitle}</h1>
                <p className="field-help">{c.nominal}</p>
                <FabricationOutputPanel />
              </>
            ) : arrange ? (
              <>
                <h1>{c.arrangementTitle}</h1>
                <LayoutPanel />
              </>
            ) : (
              <>
                <ProjectNameField key={project.metadata.id} />
                {project.fabricationMode !== 'panel-construction' ? (
                  <label className="field-stack">
                    <span>{c.material}</span>
                    <select
                      aria-label={c.material}
                      value={project.materialProfileSnapshot.id}
                      onChange={(event) => materialChanged(event.target.value)}
                    >
                      {materialLibrary.map((material) => (
                        <option key={material.id} value={material.id}>
                          {copy.materialNames[material.id as keyof typeof copy.materialNames] ??
                            material.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {project.fabricationMode === 'fold-template' ? (
                  <TemplateInspector
                    key={`${project.metadata.id}:${project.modeSettings.foldTemplate.templateKind}`}
                    onDraft={setDraft}
                  />
                ) : project.fabricationMode === 'panel-construction' ? (
                  <PanelConstructionPanel hideGenerationAction />
                ) : (
                  <>
                    <ModelImportPanel />
                    <label className="field-stack">
                      <span>{c.fabricationMode}</span>
                      <select
                        value={project.fabricationMode}
                        onChange={(event) =>
                          mode(event.target.value as typeof project.fabricationMode)
                        }
                      >
                        <option value="mesh-unfold">{copy.modes['mesh-unfold']}</option>
                        <option value="stacked-slices">{copy.stackedSlices}</option>
                        <option value="waffle-slices">{copy.waffleSlices}</option>
                      </select>
                    </label>
                    {project.fabricationMode === 'stacked-slices' ? (
                      <StackedSlicePanel hideGenerationAction />
                    ) : project.fabricationMode === 'waffle-slices' ? (
                      <WaffleSlicePanel hideGenerationAction />
                    ) : (
                      <MeshUnfoldPanel hideGenerationAction />
                    )}
                    <details>
                      <summary>{c.source}</summary>
                      <ModelInspectionPanel />
                    </details>
                  </>
                )}
              </>
            )}
          </aside>
          <main className="studio-preview">
            <div className="studio-preview-actions">
              <button type="button" onClick={() => setInspectorOpen(true)}>
                {c.design}
              </button>
              {destination === 'design' ? (
                <button type="button" onClick={() => setArrange((value) => !value)}>
                  {c.arrange}
                </button>
              ) : null}
            </div>
            <PreviewProjectContext.Provider value={shownPreview}>
              {children}
            </PreviewProjectContext.Provider>
          </main>
          <footer className="studio-bottom-bar">
            <span role="status">
              {draft !== undefined
                ? c.draft
                : status === 'processing'
                  ? c.working
                  : generation === 'stale' || generation === 'legacy-unverified'
                    ? c.stale
                    : generation === 'invalid' || status === 'error'
                      ? c.invalid
                      : generation === 'ready'
                        ? c.ready
                        : c.sourceNeeded}
            </span>
            {destination === 'design' && !arrange ? (
              <button
                className="primary-panel-action"
                type="button"
                disabled={!canGenerate || draft !== undefined}
                onClick={status === 'processing' ? cancel : generate}
              >
                {status === 'processing'
                  ? c.cancel
                  : generation === 'absent'
                    ? c.calculate
                    : c.regenerate}
              </button>
            ) : null}
          </footer>
        </div>
      )}
      {library ? <ProjectDrawer onClose={() => setLibrary(false)} onOpen={design} /> : null}
    </div>
  );
}
