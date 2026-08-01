import { describe, expect, it } from 'vitest';
import { createProject } from '../app/createProject';
import { IndexedDbProjectRepository } from './database';

describe('IndexedDbProjectRepository', () => {
  it('saves, lists, restores, and deletes a local project', async () => {
    const repository = new IndexedDbProjectRepository();
    const project = createProject('Local project');

    await repository.save(project);

    await expect(repository.get(project.metadata.id)).resolves.toEqual(project);
    await expect(repository.getLastAutosaved()).resolves.toEqual(project);
    await expect(repository.list()).resolves.toContainEqual(project.metadata);

    await repository.delete(project.metadata.id);
    await expect(repository.get(project.metadata.id)).resolves.toBeUndefined();
  });
});
