import { PapercraftUnresolvedEdits } from './PapercraftSourceReview';
import { useProjectStore } from '../../state/useProjectStore';
import { papercraftCopy } from '../../locales/papercraftCopy';
import { PapercraftEdgeInspector } from './PapercraftEdgeInspector';
import { PapercraftIslandInspector } from './PapercraftIslandInspector';
import { PapercraftOptimizationPanel } from './PapercraftOptimizationPanel';
import { PapercraftHealthPanel } from './PapercraftHealthPanel';
import { MeshUnfoldPanel } from '../panels/MeshUnfoldPanel';
export function PapercraftToolbar() {
  const native = useProjectStore((s) => s.project.papercraft),
    locale = useProjectStore((s) => s.locale),
    enable = useProjectStore((s) => s.enablePapercraft),
    legacy = useProjectStore((s) => s.useLegacyUnfolding),
    generate = useProjectStore((s) => s.generatePapercraft),
    status = useProjectStore((s) => s.sliceGenerationStatus),
    progress = useProjectStore((s) => s.papercraftProgress),
    fold = useProjectStore((s) => s.foldPreviewProgress),
    setFold = useProjectStore((s) => s.setFoldPreviewProgress),
    c = papercraftCopy(locale);
  if (!native)
    return (
      <section>
        <h2>{c.title}</h2>
        <p>{c.sourceRequired}</p>
        <button
          type="button"
          onClick={() => {
            enable();
            useProjectStore.getState().generatePapercraft({ mergeWithInputEdit: true });
          }}
        >
          {c.enable}
        </button>
        <details>
          <summary>{c.legacy}</summary>
          <MeshUnfoldPanel hideGenerationAction />
        </details>
      </section>
    );
  return (
    <section className="papercraft-toolbar">
      <h2>{c.title}</h2>
      <button type="button" disabled={status === 'processing'} onClick={() => generate()}>
        {c.optimize}
      </button>
      {progress ? (
        <p role="status">
          {c.working}:{' '}
          <span dir="ltr">
            {progress.stage} {progress.done}/{progress.total}
          </span>
        </p>
      ) : null}
      <PapercraftHealthPanel />
      <PapercraftUnresolvedEdits />
      <PapercraftOptimizationPanel />
      <label className="field-stack">
        <span>{c.fold}</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={fold}
          onChange={(event) => setFold(Number(event.target.value))}
        />
      </label>
      <PapercraftEdgeInspector />
      <PapercraftIslandInspector />
      <details>
        <summary>{c.legacy}</summary>
        <button type="button" onClick={legacy}>
          {c.legacy}
        </button>
      </details>
    </section>
  );
}
