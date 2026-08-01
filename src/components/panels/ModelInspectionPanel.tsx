import { useState, type FormEvent } from 'react';
import type { ModelAxis } from '../../domain/model';
import { copy } from '../../locales/en';
import { useProjectStore } from '../../state/useProjectStore';

interface DimensionFieldProps {
  axis: ModelAxis;
  label: string;
  value: number;
}

function formatMm(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function DimensionField({ axis, label, value }: DimensionFieldProps) {
  const [draft, setDraft] = useState(formatMm(value));
  const scaleModel = useProjectStore((state) => state.scaleModelToDimension);

  const commit = () => {
    const target = Number(draft);
    if (Number.isFinite(target) && target > 0) scaleModel(axis, target);
    else setDraft(formatMm(value));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    commit();
  };

  return (
    <form className="dimension-field" onSubmit={submit}>
      <label htmlFor={`dimension-${axis}`}>{label}</label>
      <div>
        <input
          id={`dimension-${axis}`}
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

export function ModelInspectionPanel() {
  const model = useProjectStore((state) => state.project.model);
  const rotateModel90 = useProjectStore((state) => state.rotateModel90);
  if (model.source.kind !== 'imported' || !model.healthReport || !model.bounds) return null;

  const health = model.healthReport;
  const settings = model.importSettings;

  return (
    <section className="panel-section inspection-section" aria-labelledby="inspection-heading">
      <div className="panel-heading-row">
        <p className="eyebrow">Inspect</p>
        <span className="phase-badge">Phase 2</span>
      </div>
      <h2 id="inspection-heading">{copy.modelInspection}</h2>
      <p className="inspection-file" title={model.source.fileName}>
        {model.source.fileName}
      </p>

      <fieldset className="dimension-controls">
        <legend>Correct dimensions uniformly</legend>
        <DimensionField
          key={`x-${model.dimensions.widthMm}`}
          axis="x"
          label="Width (X)"
          value={model.dimensions.widthMm}
        />
        <DimensionField
          key={`y-${model.dimensions.heightMm}`}
          axis="y"
          label="Height (Y)"
          value={model.dimensions.heightMm}
        />
        <DimensionField
          key={`z-${model.dimensions.depthMm}`}
          axis="z"
          label="Depth (Z)"
          value={model.dimensions.depthMm}
        />
        <p className="field-help">Changing one dimension preserves the model proportions.</p>
      </fieldset>

      <fieldset className="orientation-controls">
        <legend>Rotate model 90°</legend>
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

      <details className="bounds-details">
        <summary>Centred bounds in millimetres</summary>
        <dl>
          <div>
            <dt>Minimum</dt>
            <dd>{model.bounds.minMm.map(formatMm).join(', ')}</dd>
          </div>
          <div>
            <dt>Maximum</dt>
            <dd>{model.bounds.maxMm.map(formatMm).join(', ')}</dd>
          </div>
        </dl>
      </details>

      <div className="health-report" aria-labelledby="health-heading">
        <h3 id="health-heading">{copy.modelHealth}</h3>
        <dl>
          <div>
            <dt>Triangles</dt>
            <dd>{health.triangleCount.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Welded vertices</dt>
            <dd>{health.weldedVertexCount.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Open edges</dt>
            <dd className={health.openEdgeCount ? 'health-warning' : 'health-ok'}>
              {health.openEdgeCount}
            </dd>
          </div>
          <div>
            <dt>Non-manifold edges</dt>
            <dd className={health.nonManifoldEdgeCount ? 'health-warning' : 'health-ok'}>
              {health.nonManifoldEdgeCount}
            </dd>
          </div>
          <div>
            <dt>Disconnected shells</dt>
            <dd className={health.disconnectedShellCount > 1 ? 'health-warning' : 'health-ok'}>
              {health.disconnectedShellCount}
            </dd>
          </div>
          <div>
            <dt>Orientation issues</dt>
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
    </section>
  );
}
