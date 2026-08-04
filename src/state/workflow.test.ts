import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../app/createProject';
import type { ValidationIssue } from '../domain/validation';
import { useProjectStore } from './useProjectStore';
import { visibleWorkflowSteps } from './workflow';

const blockingIssue: ValidationIssue = {
  id: 'blocking',
  severity: 'error',
  code: 'NO_CLOSED_SLICES',
  message: 'No closed slices were found.',
  affectedEntityIds: [],
};

describe('visible workflow derivation', () => {
  it.each([
    ['standard', 'stacked-slices', 'ready', ['start', 'mode', 'import', 'configure', 'export']],
    ['standard', 'panel-construction', 'ready', ['start', 'mode', 'configure', 'export']],
    [
      'advanced',
      'stacked-slices',
      'ready',
      ['start', 'mode', 'import', 'configure', 'inspect', 'arrange', 'export'],
    ],
    [
      'advanced',
      'panel-construction',
      'ready',
      ['start', 'mode', 'configure', 'inspect', 'arrange', 'export'],
    ],
  ] as const)('derives %s %s steps', (experience, fabrication, status, expected) => {
    const project = createProject();
    project.fabricationMode = fabrication;
    expect(visibleWorkflowSteps(project, experience, status)).toEqual(expected);
  });

  it('inserts Inspect for Standard blocking errors but not warnings', () => {
    const project = createProject();
    project.generationIssues = [{ ...blockingIssue, severity: 'warning' }];
    expect(visibleWorkflowSteps(project, 'standard', 'ready')).not.toContain('inspect');
    project.generationIssues = [blockingIssue];
    expect(visibleWorkflowSteps(project, 'standard', 'ready')).toEqual([
      'start',
      'mode',
      'import',
      'configure',
      'inspect',
      'export',
    ]);
  });
});

describe('experience mode switching', () => {
  beforeEach(() => {
    localStorage.clear();
    const project = createProject();
    project.sheetLayouts[0]!.placements = [
      { partId: 'manual-part', x: 91, y: 37, rotationDeg: 27 },
    ];
    useProjectStore.setState({
      project,
      experienceMode: 'advanced',
      activeWorkflowStep: 'arrange',
      completedWorkflowSteps: ['start', 'mode', 'import', 'configure', 'inspect'],
      sliceGenerationStatus: 'ready',
    });
  });

  it('remaps Arrange and successful hidden Inspect to Output without changing manual layouts', () => {
    const before = structuredClone(useProjectStore.getState().project.sheetLayouts);
    useProjectStore.getState().setExperienceMode('standard');
    expect(useProjectStore.getState().activeWorkflowStep).toBe('export');
    expect(useProjectStore.getState().project.sheetLayouts).toEqual(before);
    expect(useProjectStore.getState().completedWorkflowSteps).toContain('inspect');
    expect(localStorage.getItem('mocknslice-experience-mode')).toBe('standard');

    useProjectStore.setState({ experienceMode: 'advanced', activeWorkflowStep: 'inspect' });
    useProjectStore.getState().setExperienceMode('standard');
    expect(useProjectStore.getState().activeWorkflowStep).toBe('export');
  });

  it('remaps panel-construction Import to Configure and retains error Inspect', () => {
    useProjectStore.setState((state) => ({
      project: { ...state.project, fabricationMode: 'panel-construction' },
      activeWorkflowStep: 'import',
    }));
    useProjectStore.getState().setExperienceMode('advanced');
    expect(useProjectStore.getState().activeWorkflowStep).toBe('configure');

    useProjectStore.setState((state) => ({
      project: { ...state.project, generationIssues: [blockingIssue] },
      activeWorkflowStep: 'inspect',
      sliceGenerationStatus: 'error',
    }));
    useProjectStore.getState().setExperienceMode('standard');
    expect(useProjectStore.getState().activeWorkflowStep).toBe('inspect');
  });
});
