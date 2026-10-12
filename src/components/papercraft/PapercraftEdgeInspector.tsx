import { useEffect } from 'react';
import { useProjectStore } from '../../state/useProjectStore';
import { papercraftCopy } from '../../locales/papercraftCopy';
import {
  seamEditForCommand,
  type PapercraftEdgeCommand,
} from '../../geometry/papercraft/modifySeams';

export function PapercraftEdgeInspector() {
  const native = useProjectStore((s) => s.project.papercraft),
    selected = useProjectStore((s) => s.selectedEntityId),
    locale = useProjectStore((s) => s.locale),
    processing = useProjectStore((s) => s.sliceGenerationStatus === 'processing'),
    edit = useProjectStore((s) => s.editPapercraftEdge);
  const c = papercraftCopy(locale),
    key = selected?.startsWith('edge-') ? selected.slice(5) : undefined,
    result = native?.result,
    edge = result?.unfolding.edges.find((e) => e.key === key),
    tab = result?.tabs.find((t) => t.edgeKey === key);
  const run = (command: PapercraftEdgeCommand) => {
    if (!native || !result || !key || processing) return;
    const value = seamEditForCommand(native.settings, result, key, command);
    if (value) edit(value);
  };
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.target instanceof HTMLElement &&
          event.target.closest('input,textarea,select,[contenteditable="true"]'))
      )
        return;
      const commands: Record<string, PapercraftEdgeCommand> = {
        s: 'split',
        j: 'join',
        f: 'flip',
        h: 'hide',
      };
      const command = commands[event.key.toLowerCase()];
      if (command && edge) {
        event.preventDefault();
        const value = seamEditForCommand(native!.settings, result!, edge.key, command);
        if (value && !processing) edit(value);
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [native, result, edge, processing, edit]);
  return (
    <section aria-labelledby="papercraft-edge-title">
      <h3 id="papercraft-edge-title">{c.edge}</h3>
      {edge ? (
        <>
          <p dir="ltr" data-papercraft-selected-edge={edge.key}>
            {edge.key}
          </p>
          <p>
            {c.intent}:{' '}
            <span dir="ltr">
              {native?.settings.edgeEdits.find((e) => e.id === key)?.intent ?? 'auto'}
            </span>{' '}
            · {c.resolved}: <span dir="ltr">{edge.disposition}</span>
          </p>
          <div className="papercraft-actions">
            {(
              [
                'split',
                'join',
                'auto',
                'flip',
                tab?.status === 'suppressed' ? 'show' : 'hide',
              ] as const
            ).map((command) => (
              <button
                type="button"
                key={command}
                disabled={
                  processing ||
                  ((command === 'flip' || command === 'hide' || command === 'show') &&
                    edge.disposition === 'hinge')
                }
                onClick={() => run(command)}
              >
                {c[command]}
              </button>
            ))}
          </div>
          {tab ? (
            <p>
              {tab.status} · <span dir="ltr">{tab.depthMm} mm</span>
            </p>
          ) : null}
          <p className="field-help">{c.floor}</p>
        </>
      ) : (
        <p>{c.pick}</p>
      )}
      <p className="field-help">{c.shortcuts}</p>
    </section>
  );
}
