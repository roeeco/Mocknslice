import { useState } from 'react';
import { copy, t } from '../../locales';
import { useProjectStore } from '../../state/useProjectStore';

function formatMm(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function LongestDimensionField({ value }: { value: number }) {
  const [draft, setDraft] = useState(formatMm(value));
  const scaleModel = useProjectStore((state) => state.scaleModelToLongestDimension);
  const commit = () => {
    const target = Number(draft);
    if (Number.isFinite(target) && target > 0) scaleModel(target);
    else setDraft(formatMm(value));
  };
  return (
    <form
      className="dimension-field longest-dimension-field"
      onSubmit={(event) => {
        event.preventDefault();
        commit();
      }}
    >
      <label htmlFor="longest-dimension">{t('Longest dimension')}</label>
      <div>
        <input
          id="longest-dimension"
          type="number"
          min="0.001"
          step="0.1"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
          }}
        />
        <span>mm</span>
      </div>
    </form>
  );
}

export function ModelInspectionPanel({
  mode = 'all',
}: { mode?: 'controls' | 'health' | 'all' } = {}) {
  const model = useProjectStore((state) => state.project.model);
  const rotateModel90 = useProjectStore((state) => state.rotateModel90);
  if (model.source.kind !== 'imported' || !model.healthReport || !model.bounds) return null;

  const health = model.healthReport;
  const settings = model.importSettings;

  return (
    <section className="panel-section inspection-section" aria-labelledby="inspection-heading">
      <div className="panel-heading-row">
        <p className="eyebrow">{t('Inspect')}</p>
        <span className="phase-badge">Phase 2</span>
      </div>
      <h2 id="inspection-heading">{copy.modelInspection}</h2>
      <p className="inspection-file" title={model.source.fileName}>
        {model.source.fileName}
      </p>

      {mode !== 'health' ? (
        <>
          <fieldset className="dimension-controls">
            <legend>{t('Uniform model scale')}</legend>
            <dl className="model-dimension-readout">
              <div>
                <dt>{t('Width (X)')}</dt>
                <dd>{formatMm(model.dimensions.widthMm)} mm</dd>
              </div>
              <div>
                <dt>{t('Length / depth (Z)')}</dt>
                <dd>{formatMm(model.dimensions.depthMm)} mm</dd>
              </div>
              <div>
                <dt>{t('Height (Y)')}</dt>
                <dd>{formatMm(model.dimensions.heightMm)} mm</dd>
              </div>
            </dl>
            <LongestDimensionField
              key={Math.max(
                model.dimensions.widthMm,
                model.dimensions.heightMm,
                model.dimensions.depthMm,
              )}
              value={Math.max(
                model.dimensions.widthMm,
                model.dimensions.heightMm,
                model.dimensions.depthMm,
              )}
            />
            <p className="field-help">
              {t('All axes scale together so the STL keeps its proportions.')}
            </p>
          </fieldset>

          <fieldset className="orientation-controls">
            <legend>{t('Rotate model 90°')}</legend>
            <button type="button" onClick={() => rotateModel90('x')}>
              Around X
            </button>
            <button type="button" onClick={() => rotateModel90('y')}>
              Around Y
            </button>
            <button type="button" onClick={() => rotateModel90('z')}>
              Around Z
            </button>
          </fieldset>
        </>
      ) : null}

      {mode !== 'health' ? (
        <details className="bounds-details">
          <summary>{t('Centred bounds in millimetres')}</summary>
          <dl>
            <div>
              <dt>{t('Minimum')}</dt>
              <dd>{model.bounds.minMm.map(formatMm).join(', ')}</dd>
            </div>
            <div>
              <dt>{t('Maximum')}</dt>
              <dd>{model.bounds.maxMm.map(formatMm).join(', ')}</dd>
            </div>
          </dl>
        </details>
      ) : null}

      {mode !== 'controls' ? (
        <div className="health-report" aria-labelledby="health-heading">
          <h3 id="health-heading">{copy.modelHealth}</h3>
          <dl>
            <div>
              <dt>{t('Triangles')}</dt>
              <dd>{health.triangleCount.toLocaleString()}</dd>
            </div>
            <div>
              <dt>{t('Welded vertices')}</dt>
              <dd>{health.weldedVertexCount.toLocaleString()}</dd>
            </div>
            <div>
              <dt>{t('Open edges')}</dt>
              <dd className={health.openEdgeCount ? 'health-warning' : 'health-ok'}>
                {health.openEdgeCount}
              </dd>
            </div>
            <div>
              <dt>{t('Non-manifold edges')}</dt>
              <dd className={health.nonManifoldEdgeCount ? 'health-warning' : 'health-ok'}>
                {health.nonManifoldEdgeCount}
              </dd>
            </div>
            <div>
              <dt>{t('Disconnected shells')}</dt>
              <dd className={health.disconnectedShellCount > 1 ? 'health-warning' : 'health-ok'}>
                {health.disconnectedShellCount}
              </dd>
            </div>
            <div>
              <dt>{t('Orientation issues')}</dt>
              <dd className={health.orientationIssueCount ? 'health-warning' : 'health-ok'}>
                {health.orientationIssueCount}
              </dd>
            </div>
          </dl>
          {settings ? (
            <p className="normalization-note">
              Converted from {settings.assumedUnit}; weld tolerance {settings.mergeToleranceMm} mm.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
