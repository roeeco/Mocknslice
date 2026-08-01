import { copy } from '../../locales/en';
import { useProjectStore } from '../../state/useProjectStore';
import type { WorkflowStep } from '../../state/types';

const steps = Object.entries(copy.workflow) as [WorkflowStep, string][];

export function WorkflowNavigation() {
  const activeStep = useProjectStore((state) => state.activeWorkflowStep);
  const setActiveStep = useProjectStore((state) => state.setActiveWorkflowStep);

  return (
    <nav aria-label="Project workflow" className="workflow-nav">
      <ol>
        {steps.map(([id, label], index) => (
          <li key={id}>
            <button
              className={activeStep === id ? 'workflow-step is-active' : 'workflow-step'}
              type="button"
              aria-current={activeStep === id ? 'step' : undefined}
              onClick={() => setActiveStep(id)}
            >
              <span className="step-number">{index + 1}</span>
              <span>{label}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
