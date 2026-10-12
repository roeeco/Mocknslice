import { useProjectStore } from '../../state/useProjectStore';
import { reliabilityCopy } from '../../locales/reliabilityCopy';
export function StockReliabilityControls() {
  const project = useProjectStore((s) => s.project),
    locale = useProjectStore((s) => s.locale),
    update = useProjectStore((s) => s.updatePanelComposerSettings),
    c = reliabilityCopy(locale),
    settings = project.modeSettings.panelConstruction;
  return (
    <details>
      <summary>
        {c.kerf} / {c.clearance}
      </summary>
      {(['panel', 'divider', 'lid'] as const).map((role) => (
        <section key={role}>
          <h4>{c[role]}</h4>
          {(['roleKerfMm', 'roleClearanceMm'] as const).map((field) => {
            const fallback =
                field === 'roleKerfMm'
                  ? project.materialProfileSnapshot.kerfMm
                  : settings.clearanceMm,
              values = settings[field] ?? { panel: fallback, divider: fallback, lid: fallback };
            return (
              <label className="field-stack" key={`${field}:${values[role]}`}>
                <span>{field === 'roleKerfMm' ? c.kerf : c.clearance} (mm)</span>
                <input
                  aria-label={`${c[role]} ${field === 'roleKerfMm' ? c.kerf : c.clearance} (mm)`}
                  data-runtime-draft="true"
                  type="number"
                  min="0"
                  step="0.05"
                  dir="ltr"
                  defaultValue={values[role]}
                  onBlur={(event) => {
                    const value = Number(event.target.value);
                    if (
                      event.target.value.trim() &&
                      Number.isFinite(value) &&
                      value >= 0 &&
                      value !== values[role]
                    )
                      update({ [field]: { ...values, [role]: value } });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                  }}
                />
              </label>
            );
          })}
        </section>
      ))}
    </details>
  );
}
