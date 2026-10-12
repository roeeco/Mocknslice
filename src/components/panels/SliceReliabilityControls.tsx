import { useProjectStore } from '../../state/useProjectStore';
import { reliabilityCopy } from '../../locales/reliabilityCopy';
export function SliceReliabilityControls() {
  const project = useProjectStore((s) => s.project),
    locale = useProjectStore((s) => s.locale),
    update = useProjectStore((s) => s.updateStackedSliceSettings),
    c = reliabilityCopy(locale),
    settings = project.modeSettings.stackedSlices,
    holes = settings.registrationHoles;
  const commit = (
    event: React.FocusEvent<HTMLInputElement>,
    apply: (value: number) => void,
    min: number,
    max = Infinity,
  ) => {
    const value = Number(event.target.value);
    if (event.target.value.trim() && Number.isFinite(value) && value >= min && value <= max)
      apply(value);
    else event.currentTarget.value = event.currentTarget.defaultValue;
  };
  return (
    <section>
      <p>
        {c.count}:{' '}
        <span dir="ltr">
          {
            project.generatedParts.filter(
              (p) => p.slice && p.paths.some((path) => path.contourRole === 'outer'),
            ).length
          }
        </span>{' '}
        · {c.stock}: <span dir="ltr">{settings.thicknessMm} mm</span>
      </p>
      {settings.thicknessMm > settings.spacingMm ? <p role="alert">{c.overlap}</p> : null}
      <label className="field-stack" key={settings.firstLayerOffsetMm ?? 'default'}>
        <span>{c.offset} (mm)</span>
        <input
          type="number"
          dir="ltr"
          min="0"
          defaultValue={settings.firstLayerOffsetMm ?? settings.spacingMm / 2}
          onBlur={(event) => commit(event, (n) => update({ firstLayerOffsetMm: n }), 0)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
      </label>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={settings.firstLayerOffsetMm === undefined}
          onChange={(event) =>
            update({
              firstLayerOffsetMm: event.target.checked ? undefined : settings.spacingMm / 2,
            })
          }
        />
        {c.defaultSampling}
      </label>
      <details>
        <summary>{c.registration}</summary>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={!!holes}
            onChange={(event) =>
              update({
                registrationHoles: event.target.checked
                  ? {
                      id: 'alignment',
                      centres: [
                        { x: 0.2, y: 0.5 },
                        { x: 0.8, y: 0.5 },
                      ],
                      diameterMm: 2,
                    }
                  : undefined,
              })
            }
          />
          {c.registration}
        </label>
        {holes ? (
          <>
            <label className="field-stack" key={`d:${holes.diameterMm}`}>
              <span>{c.diameter} (mm)</span>
              <input
                type="number"
                min="0.1"
                dir="ltr"
                defaultValue={holes.diameterMm}
                onBlur={(event) =>
                  commit(
                    event,
                    (n) => update({ registrationHoles: { ...holes, diameterMm: n } }),
                    0.1,
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
              />
            </label>
            {holes.centres.map((p, i) =>
              (['x', 'y'] as const).map((axis) => (
                <label className="field-stack" key={`${i}:${axis}:${p[axis]}`}>
                  <span>
                    {axis === 'x' ? c.holeX : c.holeY} {i + 1}
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    dir="ltr"
                    defaultValue={p[axis]}
                    onBlur={(event) =>
                      commit(
                        event,
                        (n) =>
                          update({
                            registrationHoles: {
                              ...holes,
                              centres: holes.centres.map((point, j) =>
                                i === j ? { ...point, [axis]: n } : point,
                              ) as typeof holes.centres,
                            },
                          }),
                        0,
                        1,
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur();
                    }}
                  />
                </label>
              )),
            )}
          </>
        ) : null}
      </details>
    </section>
  );
}
