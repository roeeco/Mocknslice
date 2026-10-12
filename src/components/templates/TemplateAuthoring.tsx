import { useEffect, useState } from 'react';
import { useProjectStore } from '../../state/useProjectStore';
import { templateRepository } from '../../persistence/database';
import { crossTrayDefinition } from '../../templates/authoring/crossTray';
import { parseTemplateDefinition } from '../../templates/authoring/validate';
import type { UserTemplateDefinition } from '../../templates/authoring/types';
import { legacyTemplateDefinitions } from '../../templates/definitions';
const text = {
  en: {
    new: 'New template',
    library: 'My templates',
    save: 'Save variant',
    name: 'Template name',
    create: 'Create cross tray',
    edit: 'Edit definition',
    apply: 'Validate and apply',
    close: 'Close',
    import: 'Import template definition',
    export: 'Export definition',
    clone: 'Clone template',
    reset: 'Reset parameters',
    alternative: 'Alternative size (+10%)',
    geometry: 'Bounded geometry definition (JSON)',
    invalid: 'Template could not be applied',
    hole: 'Add base hole',
    tab: 'Add front glue tab',
    label: 'Add base label',
    version: 'Locked version',
  },
  he: {
    new: 'תבנית חדשה',
    library: 'התבניות שלי',
    save: 'שמור גרסה אישית',
    name: 'שם תבנית',
    create: 'צור מגש צלב',
    edit: 'ערוך הגדרה',
    apply: 'אמת והחל',
    close: 'סגור',
    import: 'ייבא הגדרת תבנית',
    export: 'ייצא הגדרה',
    clone: 'שכפל תבנית',
    reset: 'אפס פרמטרים',
    alternative: 'מידה חלופית (+10%)',
    geometry: 'הגדרת גאומטריה מוגבלת (JSON)',
    invalid: 'לא ניתן להחיל תבנית',
    hole: 'הוסף חור בבסיס',
    tab: 'הוסף לשונית דבק קדמית',
    label: 'הוסף תווית בבסיס',
    version: 'גרסה נעולה',
  },
};
function download(definition: UserTemplateDefinition) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify({ format: 'mocknslice-template', version: 1, definition }, null, 2)], {
      type: 'application/json',
    }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${definition.id.replace(/[^a-z0-9-]/gi, '-')}-v${definition.version}.template.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
export function TemplateAuthoring({
  onApplied,
  onValuesDraft,
}: {
  onApplied?: () => void;
  onValuesDraft?: (values: Record<string, number> | null | undefined) => void;
}) {
  const project = useProjectStore((s) => s.project),
    locale = useProjectStore((s) => s.locale),
    apply = useProjectStore((s) => s.applyTemplateDefinition),
    update = useProjectStore((s) => s.updateTemplateValues),
    reset = useProjectStore((s) => s.resetTemplateValues),
    c = text[locale];
  const [library, setLibrary] = useState<UserTemplateDefinition[]>([]),
    [editor, setEditor] = useState<string>(),
    [name, setName] = useState(''),
    [error, setError] = useState<string>(),
    [buffers, setBuffers] = useState<Record<string, string>>({});
  const instance = project.templateInstance,
    current = project.templateDefinitions?.find(
      (d) => d.id === instance?.templateId && d.version === instance.templateVersion,
    );
  useEffect(() => {
    let live = true;
    void templateRepository
      .list()
      .then((list) => {
        if (live) setLibrary(list);
      })
      .catch((e: unknown) => {
        if (live) setError(String(e));
      });
    return () => {
      live = false;
    };
  }, []);
  const reportDraft = (draft: Record<string, string>) => {
    if (!Object.keys(draft).length) {
      onValuesDraft?.(undefined);
      return;
    }
    const values: Record<string, number> = {};
    for (const [id, value] of Object.entries(draft)) {
      const parameter = current?.parameters.find((p) => p.id === id);
      const n = Number(value);
      if (
        !value.trim() ||
        !parameter ||
        !Number.isFinite(n) ||
        n < parameter.min ||
        n > parameter.max
      ) {
        onValuesDraft?.(null);
        return;
      }
      values[id] = n;
    }
    onValuesDraft?.(values);
  };
  const activateDefinition = (definition: UserTemplateDefinition) => {
    try {
      apply(
        definition,
        current?.id === definition.id && instance
          ? Object.fromEntries(
              Object.entries(instance.values).filter(([id]) =>
                definition.parameters.some((p) => p.id === id),
              ),
            )
          : undefined,
      );
      setEditor(undefined);
      onValuesDraft?.(undefined);
      setError(undefined);
      onApplied?.();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : c.invalid);
      return false;
    }
  };
  const save = async (definition: UserTemplateDefinition) => {
    try {
      await templateRepository.save(definition);
      setLibrary(await templateRepository.list());
      setError(undefined);
    } catch (e) {
      setError(String(e));
    }
  };
  const clone = () => {
    const definition = current
      ? structuredClone(current)
      : (() => {
          const metadata = legacyTemplateDefinitions.find(
            (d) => d.legacyKind === project.modeSettings.foldTemplate.templateKind,
          )!;
          return {
            id: 'variant:temporary',
            version: 1,
            kind: 'variant' as const,
            names: { en: name || metadata.names.en, he: name || metadata.names.he },
            legacyKind: metadata.legacyKind!,
            settings: structuredClone(project.modeSettings.foldTemplate),
            parameters: metadata.parameters
              .filter((p) => typeof p.default === 'number')
              .map((p) => ({
                id: p.id,
                name: (
                  {
                    widthMm: { en: 'Width', he: 'רוחב' },
                    lengthMm: { en: 'Length', he: 'אורך' },
                    heightMm: { en: 'Height', he: 'גובה' },
                    tabDepthMm: { en: 'Tab depth', he: 'עומק לשונית' },
                    lidDepthMm: { en: 'Lid depth', he: 'עומק מכסה' },
                    lidClearanceMm: { en: 'Lid clearance', he: 'מרווח מכסה' },
                    closureFlapMm: { en: 'Closure flap', he: 'לשונית סגירה' },
                    prismSides: { en: 'Sides', he: 'צלעות' },
                    topScale: { en: 'Top ratio', he: 'יחס עליון' },
                  } as Record<string, { en: string; he: string }>
                )[p.id] ?? { en: p.id, he: p.id },
                default: Number(
                  project.modeSettings.foldTemplate[
                    p.id as keyof typeof project.modeSettings.foldTemplate
                  ],
                ),
                min: p.min ?? 0,
                max: p.max ?? 1000,
              })),
          };
        })();
    definition.id = `user:${crypto.randomUUID()}`;
    definition.version = 1;
    if (name.trim()) definition.names = { en: name.trim(), he: name.trim() };
    if (current && instance)
      definition.parameters = definition.parameters.map((p) => ({
        ...p,
        default: instance.values[p.id]!,
      }));
    if (activateDefinition(definition)) void save(definition);
  };
  const editPreset = (kind: 'hole' | 'tab' | 'label') => {
    if (current?.kind !== 'custom') return;
    const definition = structuredClone(current);
    definition.version++;
    const id = `${kind}-${crypto.randomUUID()}`;
    if (kind === 'hole')
      definition.panels
        .find((p) => p.id === 'base')
        ?.holes.push([
          {
            x: { op: 'mul', args: [{ ref: 'widthMm' }, 0.4] },
            y: { op: 'mul', args: [{ ref: 'lengthMm' }, 0.4] },
          },
          {
            x: { op: 'mul', args: [{ ref: 'widthMm' }, 0.4] },
            y: { op: 'mul', args: [{ ref: 'lengthMm' }, 0.6] },
          },
          {
            x: { op: 'mul', args: [{ ref: 'widthMm' }, 0.6] },
            y: { op: 'mul', args: [{ ref: 'lengthMm' }, 0.6] },
          },
          {
            x: { op: 'mul', args: [{ ref: 'widthMm' }, 0.6] },
            y: { op: 'mul', args: [{ ref: 'lengthMm' }, 0.4] },
          },
        ]);
    if (kind === 'tab')
      definition.tabs.push({ id, panelId: 'front', edge: 1, depthMm: 4, receiverPanelId: 'right' });
    if (kind === 'label')
      definition.marks.push({
        id,
        panelId: 'base',
        text: name || 'LABEL',
        point: {
          x: { op: 'mul', args: [{ ref: 'widthMm' }, 0.2] },
          y: { op: 'mul', args: [{ ref: 'lengthMm' }, 0.2] },
        },
      });
    setEditor(JSON.stringify(definition, null, 2));
  };
  return (
    <section aria-label={c.library}>
      <button
        type="button"
        onClick={() =>
          setEditor(JSON.stringify(crossTrayDefinition(`user:${crypto.randomUUID()}`), null, 2))
        }
      >
        {c.new}
      </button>
      <label className="field-stack">
        <span>{c.name}</span>
        <input
          aria-label={c.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-runtime-draft="true"
        />
      </label>
      {project.fabricationMode === 'fold-template' && !current ? (
        <button type="button" onClick={clone}>
          {c.save}
        </button>
      ) : null}
      {current && instance ? (
        <>
          <h3>{current.names[locale]}</h3>
          <p>
            {c.version}:{' '}
            <span dir="ltr">
              {current.version} · {instance.definitionHash}
            </span>
          </p>
          {current.parameters.map((p) => (
            <label className="field-stack" key={`${current.id}:${p.id}`}>
              <span>{p.name[locale]}</span>
              <input
                type="number"
                dir="ltr"
                aria-label={p.name[locale]}
                min={p.min}
                max={p.max}
                value={buffers[p.id] ?? instance.values[p.id]}
                data-runtime-draft={buffers[p.id] !== undefined || undefined}
                onChange={(e) => {
                  const next = { ...buffers, [p.id]: e.target.value };
                  setBuffers(next);
                  reportDraft(next);
                }}
                onBlur={() => {
                  if (buffers[p.id] === undefined) return;
                  const value = Number(buffers[p.id]);
                  try {
                    if (!buffers[p.id]?.trim()) throw new Error('Empty dimension');
                    if (value !== instance.values[p.id]) update({ [p.id]: value });
                    setBuffers({});
                    reportDraft({});
                    setError(undefined);
                  } catch (e) {
                    setError(String(e));
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') {
                    setBuffers({});
                    reportDraft({});
                  }
                }}
              />
            </label>
          ))}
          <button type="button" onClick={clone}>
            {c.clone}
          </button>
          <button type="button" onClick={reset}>
            {c.reset}
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                update(
                  Object.fromEntries(
                    current.parameters.map((p) => [
                      p.id,
                      ['widthMm', 'lengthMm', 'heightMm'].includes(p.id)
                        ? Math.round(instance.values[p.id]! * 1.1 * 1e6) / 1e6
                        : instance.values[p.id]!,
                    ]),
                  ),
                );
              } catch (e) {
                setError(String(e));
              }
            }}
          >
            {c.alternative}
          </button>
          <button type="button" onClick={() => download(current)}>
            {c.export}
          </button>
          <button
            type="button"
            onClick={() => {
              const def = structuredClone(current);
              def.version++;
              setEditor(JSON.stringify(def, null, 2));
            }}
          >
            {c.edit}
          </button>
          {current.kind === 'custom' ? (
            <>
              <button type="button" onClick={() => editPreset('hole')}>
                {c.hole}
              </button>
              <button type="button" onClick={() => editPreset('tab')}>
                {c.tab}
              </button>
              <button type="button" onClick={() => editPreset('label')}>
                {c.label}
              </button>
            </>
          ) : null}
        </>
      ) : null}
      <label className="field-stack">
        <span>{c.import}</span>
        <input
          type="file"
          accept=".json"
          aria-label={c.import}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) {
              setError('Template file exceeds 2 MiB');
              return;
            }
            void file
              .text()
              .then((source) => {
                const parsed: unknown = JSON.parse(source);
                if (
                  !parsed ||
                  typeof parsed !== 'object' ||
                  !('format' in parsed) ||
                  parsed.format !== 'mocknslice-template' ||
                  !('version' in parsed) ||
                  parsed.version !== 1 ||
                  !('definition' in parsed)
                )
                  throw new Error('Unsupported template file');
                const def = parseTemplateDefinition(parsed.definition);
                setEditor(JSON.stringify(def, null, 2));
              })
              .catch((err: unknown) => setError(String(err)));
            e.target.value = '';
          }}
        />
      </label>
      <details>
        <summary>
          {c.library} ({library.length})
        </summary>
        {library.map((d) => (
          <button type="button" key={`${d.id}:${d.version}`} onClick={() => activateDefinition(d)}>
            {d.names[locale]} · v{d.version}
          </button>
        ))}
      </details>
      {editor !== undefined ? (
        <div role="dialog" aria-label={c.new} className="template-definition-editor">
          <label className="field-stack">
            <span>{c.geometry}</span>
            <textarea
              aria-label={c.geometry}
              dir="ltr"
              rows={16}
              value={editor}
              data-runtime-draft="true"
              onChange={(e) => {
                setEditor(e.target.value);
                onValuesDraft?.(null);
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              try {
                if (editor.length > 2 * 1024 * 1024) throw new Error('Definition exceeds 2 MiB');
                const definition = parseTemplateDefinition(JSON.parse(editor));
                if (activateDefinition(definition)) void save(definition);
              } catch (e) {
                setError(String(e));
              }
            }}
          >
            {c.apply}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditor(undefined);
              onValuesDraft?.(undefined);
            }}
          >
            {c.close}
          </button>
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
