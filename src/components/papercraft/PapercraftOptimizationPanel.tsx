import { useState } from 'react';
import { useProjectStore } from '../../state/useProjectStore';
import { papercraftCopy } from '../../locales/papercraftCopy';
function FaceTargetControl({
  value,
  processing,
  label,
  commit,
}: {
  value: number;
  processing: boolean;
  label: string;
  commit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <label className="field-stack">
      <span>
        {label}: <span dir="ltr">{draft}</span>
      </span>
      <input
        aria-label={label}
        type="range"
        min="4"
        max="200"
        step="1"
        value={draft}
        disabled={processing}
        data-runtime-draft={draft !== value || undefined}
        onChange={(event) => setDraft(Number(event.target.value))}
        onBlur={() => {
          if (draft !== value) commit(draft);
        }}
        onPointerUp={(event) => event.currentTarget.blur()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') setDraft(value);
        }}
      />
    </label>
  );
}
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
      <FaceTargetControl
        key={`${settings.sourceMeshHash}:${settings.faceTarget}`}
        value={settings.faceTarget}
        processing={processing}
        label={c.target}
        commit={(faceTarget) => update({ faceTarget })}
      />
      <span className="range-labels">
        {c.fewer} · {c.details}
      </span>
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
              ) {
                if (n !== settings[key]) update({ [key]: n });
              } else event.currentTarget.value = String(settings[key]);
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
