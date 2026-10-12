import { describe, expect, it } from 'vitest';
import { createProject } from '../app/createProject';
import {
  createStoredProjectRecord,
  IndexedDbProjectRepository,
  migrateStoredProjectRecord,
} from './database';
import { legacyProjectFixtures } from '../test-fixtures/legacyProjectFiles';
import { openDB } from 'idb';

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

  it('migrates an unversioned raw IndexedDB v6 record through the file migration path', () => {
    const envelope = JSON.parse(legacyProjectFixtures[5].source) as { project: unknown };
    const restored = migrateStoredProjectRecord(envelope.project);
    expect(restored.metadata.id).toBe('project-legacy-fixture');
    expect(restored.modeSettings.meshUnfold.manualSeamKeys).toEqual([]);
    expect(restored.modeSettings.panelConstruction.features).toEqual([]);
  });

  it('rewrites an existing raw IndexedDB v6 record as storage version 9 on restore', async () => {
    const repository = new IndexedDbProjectRepository();
    await repository.save(createProject('Database bootstrap'));
    const envelope = JSON.parse(legacyProjectFixtures[5].source) as {
      project: { metadata: { id: string } };
    };
    const database = await openDB('slicefold', 2);
    await database.put('projects', envelope.project);

    const restored = await repository.get(envelope.project.metadata.id);
    expect(restored?.modeSettings.panelConstruction.features).toEqual([]);
    await expect(database.get('projects', envelope.project.metadata.id)).resolves.toMatchObject({
      storageVersion: 9,
      metadata: { id: envelope.project.metadata.id },
    });
    database.close();
  });

  it('writes local records with storage version 9 while retaining the metadata key path', () => {
    const project = createProject('Stored v7');
    const record = createStoredProjectRecord(project);
    expect(record.storageVersion).toBe(9);
    expect(record.metadata.id).toBe(project.metadata.id);
    expect(record.modeSettings).toEqual(project.modeSettings);
  });

  it('migrates a raw storage-version 7 record through the same v8 topology upgrader', () => {
    const project = createProject('Stored v7 topology');
    const raw = structuredClone(project) as typeof project & { storageVersion: 7 };
    raw.storageVersion = 7;
    raw.modeSettings.panelConstruction.connectionOverrides = {
      'base-front': { jointKind: 'butt' },
    } as never;

    const restored = migrateStoredProjectRecord(raw);
    expect(restored.modeSettings.panelConstruction.connectionOverrides).toEqual({
      'base-front': { treatment: 'butt' },
    });
    expect(restored.modeSettings.foldTemplate.glueTabDepthMm).toBe(8);
  });
});
