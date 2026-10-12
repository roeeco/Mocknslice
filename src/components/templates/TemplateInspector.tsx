import { useState } from 'react';
import type { FoldTemplateSettings } from '../../domain/modeSettings';
import { useProjectStore } from '../../state/useProjectStore';
import { legacyTemplateDefinitions } from '../../templates/definitions';
import { studioCopy } from '../../locales/studioCopy';
import { ConnectionInspector } from '../panels/ConnectionInspector';

type NumericKey =
  | 'widthMm'
  | 'lengthMm'
  | 'heightMm'
  | 'tabDepthMm'
  | 'lidDepthMm'
  | 'lidClearanceMm'
  | 'closureFlapMm'
  | 'prismSides'
  | 'topScale';
export function TemplateInspector({
  onDraft,
}: {
  onDraft: (patch: Partial<FoldTemplateSettings> | null | undefined) => void;
}) {
  const project = useProjectStore((state) => state.project),
    locale = useProjectStore((state) => state.locale),
    processing = useProjectStore((state) => state.sliceGenerationStatus === 'processing');
  const update = useProjectStore((state) => state.updateFoldTemplateSettings),
    generate = useProjectStore((state) => state.generateFoldTemplate);
  const c = studioCopy(locale),
    settings = project.modeSettings.foldTemplate;
  const definition = legacyTemplateDefinitions.find(
    (def) => def.legacyKind === settings.templateKind,
  )!;
  const [buffers, setBuffers] = useState<Partial<Record<NumericKey, string>>>({}),
    [invalid, setInvalid] = useState<string>();
  const labels: Record<string, string> = {
    widthMm: c.width,
    lengthMm: c.length,
    heightMm: c.height,
    tabDepthMm: c.tabDepth,
    lidDepthMm: c.lidDepth,
    lidClearanceMm: c.lidClearance,
    closureFlapMm: c.closureFlap,
    prismSides: c.sides,
    topScale: c.topScale,
  };
  const draftFor = (values: Partial<Record<NumericKey, string>>) => {
    if (!Object.keys(values).length) return undefined;
    const patch: Partial<FoldTemplateSettings> = {};
    for (const [name, text] of Object.entries(values)) {
      const constraint = definition.parameters.find((p) => p.id === name)!;
      const number = Number(text);
      if (
        !text.trim() ||
        !Number.isFinite(number) ||
        (constraint.kind === 'integer' && !Number.isInteger(number)) ||
        number < (constraint.min ?? -Infinity) ||
        number > (constraint.max ?? Infinity)
      )
        return null;
      Object.assign(patch, { [name]: number }, name === 'heightMm' ? { wallHeightMm: number } : {});
    }
    return patch;
  };
  const commit = (key: NumericKey) => {
    const text = buffers[key];
    if (text === undefined) return;
    const parameter = definition.parameters.find((p) => p.id === key)!;
    const value = Number(text);
    if (
      !text.trim() ||
      !Number.isFinite(value) ||
      value < (parameter.min ?? -Infinity) ||
      value > (parameter.max ?? Infinity) ||
      (parameter.kind === 'integer' && !Number.isInteger(value))
    ) {
      setInvalid(key);
      onDraft(null);
      return;
    }
    const next = { ...buffers };
    delete next[key];
    setBuffers(next);
    setInvalid(undefined);
    if (value !== settings[key]) {
      update(key === 'heightMm' ? { heightMm: value, wallHeightMm: value } : { [key]: value });
      generate({ mergeWithInputEdit: true });
    }
    onDraft(draftFor(next));
  };
  const field = (key: NumericKey) => {
    const parameter = definition.parameters.find((p) => p.id === key);
    if (!parameter) return null;
    return (
      <label className="field-stack studio-number" key={key}>
        <span>{labels[key]}</span>
        <div className="unit-input" dir="ltr">
          <input
            type="number"
            aria-label={labels[key]}
            dir="ltr"
            data-runtime-draft={buffers[key] !== undefined || undefined}
            min={parameter.min}
            max={parameter.max}
            step={parameter.step ?? 0.5}
            value={buffers[key] ?? settings[key]}
            disabled={processing}
            aria-invalid={invalid === key}
            onChange={(event) => {
              const next = { ...buffers, [key]: event.target.value };
              setBuffers(next);
              const patch = draftFor(next);
              setInvalid(patch === null ? key : undefined);
              onDraft(patch);
            }}
            onBlur={() => commit(key)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commit(key);
              }
              if (event.key === 'Escape') {
                setBuffers({});
                setInvalid(undefined);
                onDraft(undefined);
              }
            }}
          />
          {parameter.kind === 'length' ? <span>{c.mm}</span> : null}
        </div>
        {invalid === key ? <span role="alert">{c.invalidNumber}</span> : null}
      </label>
    );
  };
  return (
    <section className="studio-template-inspector" aria-labelledby="template-inspector-title">
      <h2 id="template-inspector-title">{definition.names[locale]}</h2>
      <p className="field-help">{c.experimental}</p>
      {field('widthMm')}
      {field('lengthMm')}
      {field('heightMm')}
      <label className="field-stack">
        <span>{c.closure}</span>
        <select
          aria-label={c.closure}
          value={settings.closureMethod}
          disabled={processing}
          onChange={(event) => {
            update({ closureMethod: event.target.value as 'glue' | 'press-fit' });
            generate({ mergeWithInputEdit: true });
          }}
        >
          <option value="glue">{c.glue}</option>
          <option value="press-fit">{c.pressFit}</option>
        </select>
      </label>
      {field('tabDepthMm')}
      {field('lidDepthMm')}
      {field('closureFlapMm')}
      {field('prismSides')}
      {field('topScale')}
      <details>
        <summary>{c.advanced}</summary>
        {field('lidClearanceMm')}
        <ConnectionInspector mode="fold-template" />
      </details>
      <p className="field-help">{c.nominal}</p>
    </section>
  );
}
