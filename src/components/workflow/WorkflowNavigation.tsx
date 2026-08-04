import { copy, t } from '../../locales';
import { useProjectStore } from '../../state/useProjectStore';
import type { WorkflowStep } from '../../state/types';
import { visibleWorkflowSteps } from '../../state/workflow';

export function WorkflowNavigation() {
  const project = useProjectStore((state) => state.project);
  const experienceMode = useProjectStore((state) => state.experienceMode);
  const generationStatus = useProjectStore((state) => state.sliceGenerationStatus);
  const visibleSteps = visibleWorkflowSteps(project, experienceMode, generationStatus);
  const steps = visibleSteps.map((id) => [id, copy.workflow[id]] as [WorkflowStep, string]);
  const activeStep = useProjectStore((state) => state.activeWorkflowStep);
  const setActiveStep = useProjectStore((state) => state.setActiveWorkflowStep);
  const completed = useProjectStore((state) => state.completedWorkflowSteps);
  const setViewportMode = useProjectStore((state) => state.setViewportMode);

  const navigate = (step: WorkflowStep) => {
    if (step !== activeStep && !completed.includes(step)) return;
    setActiveStep(step);
    if (step === 'arrange' || step === 'export') setViewportMode('two');
    else if (step === 'import' || step === 'configure' || step === 'inspect')
      setViewportMode('three');
  };

  return (
    <nav aria-label={t('Project workflow')} className="workflow-nav">
      <ol>
        {steps.map(([id, label], index) => (
          <li key={id}>
            <button
              className={`${activeStep === id ? 'workflow-step is-active' : 'workflow-step'}${completed.includes(id) ? ' is-complete' : ''}`}
              type="button"
              disabled={id !== activeStep && !completed.includes(id)}
              aria-current={activeStep === id ? 'step' : undefined}
              onClick={() => navigate(id)}
            >
              <span className="step-number">{completed.includes(id) ? '✓' : index + 1}</span>
              <span>{label}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
