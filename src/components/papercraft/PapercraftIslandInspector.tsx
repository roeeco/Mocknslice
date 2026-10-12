import { useEffect } from 'react';
import { useProjectStore } from '../../state/useProjectStore';
import { papercraftCopy } from '../../locales/papercraftCopy';
export function PapercraftIslandInspector() {
  const project = useProjectStore((s) => s.project),
    selected = useProjectStore((s) => s.selectedPartId),
    edit = useProjectStore((s) => s.editPapercraftIsland),
    locale = useProjectStore((s) => s.locale);
  const c = papercraftCopy(locale),
    island = project.papercraft?.result?.islands.find((i) => i.id === selected),
    placement = project.sheetLayouts
      .flatMap((s) => s.placements)
      .find((p) => p.partId === selected),
    prior = project.papercraft?.settings.islandEdits.find((i) => i.id === selected),
    locked = prior?.layoutLocked ?? false;
  const update = (patch: {
    x?: number;
    y?: number;
    rotationDeg?: number;
    layoutLocked?: boolean;
  }) => {
    if (!island || !placement) return;
    edit({
      id: island.id,
      rootFaceId: island.rootFaceId,
      translationMm: [patch.x ?? placement.x, patch.y ?? placement.y],
      rotationDeg: patch.rotationDeg ?? placement.rotationDeg,
      layoutLocked: patch.layoutLocked ?? locked,
    });
  };
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== 'r' ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.target instanceof HTMLElement &&
          event.target.closest('input,textarea,select,[contenteditable="true"]')) ||
        !island ||
        !placement ||
        locked
      )
        return;
      event.preventDefault();
      edit({
        id: island.id,
        rootFaceId: island.rootFaceId,
        translationMm: [placement.x, placement.y],
        rotationDeg: (placement.rotationDeg + 90) % 360,
        layoutLocked: false,
      });
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [island, placement, locked, edit]);
  return (
    <section>
      <h3>{c.island}</h3>
      {island && placement ? (
        <>
          <p>
            {island.faceIds.length} {c.faces}
          </p>
          {(['x', 'y', 'rotationDeg'] as const).map((key) => (
            <label className="field-stack" key={`${key}:${placement[key]}`}>
              <span>{key === 'rotationDeg' ? c.rotation : c[key]}</span>
              <input
                type="number"
                dir="ltr"
                disabled={locked}
                defaultValue={placement[key]}
                onBlur={(event) => {
                  if (event.target.value.trim() && Number.isFinite(Number(event.target.value)))
                    update({ [key]: Number(event.target.value) });
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
              />
            </label>
          ))}
          <button type="button" onClick={() => update({ layoutLocked: !locked })}>
            {locked ? c.unlock : c.lock}
          </button>
        </>
      ) : (
        <p>{c.none}</p>
      )}
    </section>
  );
}
