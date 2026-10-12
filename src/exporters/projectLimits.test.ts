import { describe, expect, it } from 'vitest';
import { createProject } from '../app/createProject';
import { parseProjectFile, migrateProjectFile } from './importProject';
import { serializeProject } from './exportProject';

describe('project import bounds', () => {
  it('requires v9 validation for every native project field', () => {
    for (const field of [
      'papercraft',
      'templateInstance',
      'templateDefinitions',
      'designGraph',
      'unresolvedEdits',
    ]) {
      const project = { ...createProject(), [field]: {} };
      expect(() =>
        migrateProjectFile({ format: 'mocknslice-project', version: 8, project }),
      ).toThrow('schema v9');
    }
  });
  it('rejects oversized files and excessive nesting before state replacement', () => {
    expect(() => parseProjectFile(' '.repeat(20 * 1024 * 1024 + 1))).toThrow('20 MiB');
    let nested: unknown = {};
    for (let i = 0; i < 70; i++) nested = { next: nested };
    expect(() =>
      migrateProjectFile({ format: 'mocknslice-project', version: 9, project: { extra: nested } }),
    ).toThrow('complexity');
  });
  it('rejects out-of-range mesh indices and more than 100,000 triangles', () => {
    const project = createProject();
    project.model.mesh!.indices[0] = 10000;
    expect(() => parseProjectFile(serializeProject(project))).toThrow('invalid indices');
    const large = createProject();
    large.model.mesh!.indices = Array<number>(300003).fill(0);
    expect(() => parseProjectFile(serializeProject(large))).toThrow('100,000');
  });
  it('rejects more than 10,000 fabrication paths and unsafe property names', () => {
    const project = createProject();
    project.generatedParts = [
      {
        id: 'many',
        name: 'Many',
        thicknessMm: 1,
        paths: Array.from({ length: 10001 }, (_, i) => ({
          id: `cut-${i}`,
          operation: 'cut' as const,
          closed: false,
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
          ],
        })),
      },
    ];
    expect(() => parseProjectFile(serializeProject(project))).toThrow('10,000');
    expect(() =>
      parseProjectFile('{"format":"mocknslice-project","version":9,"project":{"__proto__":{}}}'),
    ).toThrow('Unsafe');
  });
});
