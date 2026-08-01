import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../../app/createProject';
import { normalizeMesh } from '../../geometry/mesh/normalizeMesh';
import { createOpenCubeSoup } from '../../test-fixtures/generatedMeshes';
import { useProjectStore } from '../useProjectStore';

describe('model state slice', () => {
  beforeEach(() => {
    useProjectStore.setState({
      project: createProject('Model state'),
      past: [],
      future: [],
      modelImportStatus: 'idle',
      modelImportError: undefined,
    });
  });

  it('publishes structured mesh warnings and restores them across history', () => {
    const result = normalizeMesh(createOpenCubeSoup(), { assumedUnit: 'millimetres' });
    useProjectStore.getState().completeModelImport('open-cube.stl', result);

    expect(useProjectStore.getState().validationIssues.map((issue) => issue.code)).toContain(
      'OPEN_MESH',
    );
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().validationIssues.map((issue) => issue.code)).toEqual([
      'PHASE_2_STL_INSPECTION',
    ]);
    useProjectStore.getState().redo();
    expect(useProjectStore.getState().validationIssues.map((issue) => issue.code)).toContain(
      'OPEN_MESH',
    );
  });
});
