import type { ChangeEvent } from 'react';
import type { FabricationMode } from '../../domain/fabrication';
import { copy } from '../../locales/en';
import { useProjectStore } from '../../state/useProjectStore';

const modes = Object.entries(copy.modes) as [FabricationMode, string][];

export function ParameterPanel() {
  const project = useProjectStore((state) => state.project);
  const materials = useProjectStore((state) => state.materials);
  const renameProject = useProjectStore((state) => state.renameProject);
  const selectMaterial = useProjectStore((state) => state.selectMaterial);
  const setFabricationMode = useProjectStore((state) => state.setFabricationMode);

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    renameProject(event.target.value);
  };

  return (
    <section className="panel-section" aria-labelledby="parameters-heading">
      <div className="panel-heading-row">
        <p className="eyebrow">Setup</p>
        <span className="phase-badge">Foundation</span>
      </div>
      <h2 id="parameters-heading">{copy.parametersPanel}</h2>

      <div className="field-stack">
        <label htmlFor="project-name">{copy.projectName}</label>
        <input
          id="project-name"
          value={project.metadata.name}
          onChange={handleNameChange}
          autoComplete="off"
        />
      </div>

      <div className="field-stack">
        <label htmlFor="fabrication-mode">{copy.fabricationMode}</label>
        <select
          id="fabrication-mode"
          value={project.fabricationMode}
          onChange={(event) => setFabricationMode(event.target.value as FabricationMode)}
        >
          {modes.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <p className="field-help">
          Mode selection is saved now; geometry generation arrives by phase.
        </p>
      </div>

      <div className="field-stack">
        <label htmlFor="material-profile">{copy.material}</label>
        <select
          id="material-profile"
          value={project.materialProfileSnapshot.id}
          onChange={(event) => selectMaterial(event.target.value)}
        >
          {materials.map((material) => (
            <option key={material.id} value={material.id}>
              {material.name}
            </option>
          ))}
        </select>
      </div>

      <dl className="measurement-list">
        <div>
          <dt>{copy.thickness}</dt>
          <dd>{project.materialProfileSnapshot.thicknessMm} mm</dd>
        </div>
        <div>
          <dt>{copy.kerf}</dt>
          <dd>{project.materialProfileSnapshot.kerfMm} mm</dd>
        </div>
        <div>
          <dt>{copy.clearance}</dt>
          <dd>{project.materialProfileSnapshot.clearanceMm} mm</dd>
        </div>
      </dl>

      <div className="model-card">
        <p className="eyebrow">{copy.dimensions}</p>
        <strong>{project.model.name}</strong>
        <span>
          {project.model.dimensions.widthMm} × {project.model.dimensions.heightMm} ×{' '}
          {project.model.dimensions.depthMm} mm
        </span>
      </div>
    </section>
  );
}
