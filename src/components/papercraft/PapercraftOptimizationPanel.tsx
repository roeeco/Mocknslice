import { useProjectStore } from '../../state/useProjectStore';
import { papercraftCopy } from '../../locales/papercraftCopy';
export function PapercraftOptimizationPanel() {
  const native = useProjectStore((s) => s.project.papercraft),
    locale = useProjectStore((s) => s.locale),
    processing = useProjectStore((s) => s.sliceGenerationStatus === 'processing'),
    update = useProjectStore((s) => s.updatePapercraftSettings);
  if (!native) return null;
  const c = papercraftCopy(locale),
    settings = native.settings;
  return (
    <section>
      <label className="field-stack">
        <span>{c.preset}</span>
        <select
          disabled={processing}
          value={settings.optimizer}
          onChange={(event) =>
            update({ optimizer: event.target.value as typeof settings.optimizer })
          }
        >
          <option value="balanced">{c.balanced}</option>
          <option value="few-pieces">{c.few}</option>
          <option value="compact">{c.compact}</option>
          <option value="preserve-sharp-edges">{c.sharp}</option>
        </select>
      </label>
      <label className="field-stack">
        <span>
          {c.target}: <output dir="ltr">{settings.faceTarget}</output>
        </span>
        <input
          type="range"
          min="4"
          max="200"
          step="1"
          value={settings.faceTarget}
          disabled={processing}
          onChange={(event) => update({ faceTarget: Number(event.target.value) })}
        />
        <span className="range-labels">
          {c.fewer} · {c.details}
        </span>
      </label>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={native.acceptSimplification}
          disabled={processing}
          onChange={(event) => update({}, event.target.checked)}
        />
        {c.accept}
      </label>
      {(['maxCandidates', 'tabDefaultDepthMm', 'maximumDeviationMm'] as const).map((key) => (
        <label className="field-stack" key={`${key}:${settings[key]}`}>
          <span>
            {key === 'maxCandidates'
              ? c.candidates
              : key === 'maximumDeviationMm'
                ? c.deviation
                : c.depth}
          </span>
          <input
            type="number"
            dir="ltr"
            min={key === 'maximumDeviationMm' ? 0 : 1}
            max={key === 'maxCandidates' ? 32 : undefined}
            disabled={processing}
            defaultValue={settings[key]}
            onBlur={(event) => {
              const n = Number(event.target.value);
              if (
                event.target.value.trim() &&
                Number.isFinite(n) &&
                n >= (key === 'maximumDeviationMm' ? 0 : 1) &&
                (key !== 'maxCandidates' || (Number.isInteger(n) && n <= 32))
              )
                update({ [key]: n });
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
          />
        </label>
      ))}
    </section>
  );
}
