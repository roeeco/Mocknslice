import { outputIssueMessage } from '../../locales/outputCopy';
import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../../state/useProjectStore';
const copy = {
  en: {
    title: 'Review source update',
    kept: 'Your current source and last valid net remain unchanged until you accept.',
    matched: 'Confidently matched edits',
    missing: 'Unresolved edits',
    accept: 'Accept source update',
    cancel: 'Cancel source update',
    resolve: 'Review unmatched edits before cutting',
    target: 'Map edit to current entity',
    map: 'Apply edit to selected entity',
    discard: 'Discard this unmatched edit',
    select: 'Choose an entity',
    stale: 'The project changed during review. Cancel and prepare the update again.',
    edge: 'Edge',
    island: 'Island',
    reprepare: 'Review mesh preparation',
    limit:
      'Unmatched edits remain saved and block cutting until you resolve or explicitly discard them.',
  },
  he: {
    title: 'בדיקת עדכון מקור',
    kept: 'המקור הנוכחי והפריסה התקינה האחרונה נשמרים עד לאישור.',
    matched: 'עריכות שהותאמו בוודאות',
    missing: 'עריכות ללא התאמה',
    accept: 'אשר עדכון מקור',
    cancel: 'בטל עדכון מקור',
    resolve: 'בדוק עריכות ללא התאמה לפני חיתוך',
    target: 'התאם עריכה לישות נוכחית',
    map: 'החל עריכה על הישות שנבחרה',
    discard: 'מחק את העריכה ללא התאמה',
    select: 'בחר ישות',
    stale: 'הפרויקט השתנה בזמן הבדיקה. בטל והכן שוב את העדכון.',
    edge: 'קצה',
    island: 'אי',
    reprepare: 'בדוק הכנת רשת',
    limit: 'עריכות ללא התאמה נשמרות וחוסמות חיתוך עד להתאמה או מחיקה מפורשת.',
  },
};
export function PapercraftSourceReview() {
  const pending = useProjectStore((s) => s.pendingModelUpdate),
    project = useProjectStore((s) => s.project),
    locale = useProjectStore((s) => s.locale),
    accept = useProjectStore((s) => s.acceptPapercraftModelUpdate),
    cancel = useProjectStore((s) => s.cancelPapercraftModelUpdate),
    c = copy[locale];
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (pending && ref.current && !ref.current.open) {
      if (typeof ref.current.showModal === 'function') ref.current.showModal();
      else ref.current.open = true;
    }
  }, [pending]);
  if (!pending) return null;
  const stale = pending.originalProject !== project;
  return (
    <dialog
      ref={ref}
      aria-labelledby="source-update-title"
      className="source-update-dialog"
      onCancel={(e) => {
        e.preventDefault();
        cancel();
      }}
    >
      <h2 id="source-update-title">{c.title}</h2>
      <p>{c.kept}</p>
      <p>{pending.model.name}</p>
      <p>
        {c.matched}:{' '}
        <strong>{pending.proposal.edgeMatches.length + pending.proposal.islandEdits.length}</strong>
      </p>
      <p>
        {c.missing}: <strong>{pending.proposal.unresolvedEdits.length}</strong>
      </p>
      <p>{c.limit}</p>
      {pending.proposal.unresolvedEdits.slice(0, 30).map((edit) => (
        <p key={edit.id}>
          <span dir="ltr">{edit.edit.id}</span> · {edit.kind === 'edge' ? c.edge : c.island}
        </p>
      ))}
      {pending.proposal.issues.slice(0, 30).map((issue) => (
        <p role={issue.severity === 'error' ? 'alert' : 'status'} key={issue.id}>
          {outputIssueMessage(issue, locale)}
        </p>
      ))}
      {stale ? <p role="alert">{c.stale}</p> : null}
      <button
        type="button"
        disabled={stale || pending.proposal.issues.some((i) => i.severity === 'error')}
        onClick={accept}
      >
        {c.accept}
      </button>
      <button type="button" autoFocus onClick={cancel}>
        {c.cancel}
      </button>
    </dialog>
  );
}
export function PapercraftUnresolvedEdits() {
  const project = useProjectStore((s) => s.project),
    locale = useProjectStore((s) => s.locale),
    resolve = useProjectStore((s) => s.resolvePapercraftEdit),
    processing = useProjectStore((s) => s.sliceGenerationStatus === 'processing'),
    propose = useProjectStore((s) => s.proposePapercraftModelUpdate),
    c = copy[locale];
  const [targets, setTargets] = useState<Record<string, string>>({});
  const edges = [
      ...new Set(project.papercraft?.result?.source.halfEdges.map((e) => e.edgeKey) ?? []),
    ].sort(),
    islands = project.papercraft?.result?.islands.map((i) => i.id) ?? [];
  return (
    <section>
      {project.papercraft?.workingSource ? (
        <button type="button" disabled={processing} onClick={() => propose(project.model)}>
          {c.reprepare}
        </button>
      ) : null}
      {project.unresolvedEdits?.length ? (
        <>
          <h3>{c.resolve}</h3>
          <p>{c.limit}</p>
          {project.unresolvedEdits.map((edit) => (
            <div key={edit.id} data-unresolved-edit={edit.id}>
              <p dir="ltr">{edit.edit.id}</p>
              <label>
                {c.target}
                <select
                  dir="ltr"
                  aria-label={`${c.target}: ${edit.edit.id}`}
                  value={targets[edit.id] ?? ''}
                  disabled={processing}
                  onChange={(e) => setTargets({ ...targets, [edit.id]: e.target.value })}
                >
                  <option value="">{c.select}</option>
                  {(edit.kind === 'edge' ? edges : islands)
                    .filter(
                      (id) =>
                        edit.kind !== 'edge' ||
                        !project.papercraft!.settings.edgeEdits.some((active) => active.id === id),
                    )
                    .map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="button"
                disabled={processing || !targets[edit.id]}
                onClick={() => resolve(edit.id, targets[edit.id])}
              >
                {c.map}
              </button>
              <button type="button" disabled={processing} onClick={() => resolve(edit.id)}>
                {c.discard}
              </button>
            </div>
          ))}
        </>
      ) : null}
    </section>
  );
}
