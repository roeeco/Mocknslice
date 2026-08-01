import { describe, expect, it } from 'vitest';
import { createProject } from '../app/createProject';
import { serializeProject } from './exportProject';
import { parseProjectFile, ProjectImportError } from './importProject';

describe('SliceFold project format', () => {
  it('round-trips a version 1 project without losing fabrication data', () => {
    const project = createProject('Round trip');
    const restored = parseProjectFile(serializeProject(project));

    expect(restored).toEqual(project);
    expect(restored.materialProfileSnapshot.name).toBe('300 gsm card');
  });

  it('rejects unrelated JSON with an understandable error', () => {
    expect(() => parseProjectFile('{"format":"other"}')).toThrowError(
      new ProjectImportError('This file is not a SliceFold project.'),
    );
  });

  it('rejects unsupported future versions through the migration entry point', () => {
    expect(() =>
      parseProjectFile('{"format":"slicefold-project","version":99,"project":{}}'),
    ).toThrow('Project version 99 is not supported by this build.');
  });

  it('rejects a versioned file with malformed nested dimensions', () => {
    const malformed = JSON.parse(serializeProject(createProject())) as Record<string, unknown>;
    const project = malformed.project as Record<string, unknown>;
    const model = project.model as Record<string, unknown>;
    model.dimensions = { widthMm: 'large', heightMm: 40, depthMm: 40 };

    expect(() => parseProjectFile(JSON.stringify(malformed))).toThrow(
      'The project file is incomplete or damaged.',
    );
  });
});
