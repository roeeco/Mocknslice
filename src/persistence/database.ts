import { type DBSchema, type IDBPDatabase, openDB } from 'idb';
import type { LegacyProjectData, ProjectData, ProjectMetadata } from '../domain/project';
import type { ProjectRepository } from './projectRepository';
import { migrateProjectFile } from '../exporters/importProject';

const DATABASE_NAME = 'slicefold';
const DATABASE_VERSION = 1;
const LAST_AUTOSAVE_KEY = 'last-autosave-project-id';

interface SliceFoldDatabase extends DBSchema {
  projects: {
    key: string;
    value: StoredProjectRecord | LegacyProjectData;
    indexes: { 'by-updated-at': string };
  };
  settings: {
    key: string;
    value: string;
  };
}

export type StoredProjectRecord = ProjectData & { storageVersion: 8 };

export function createStoredProjectRecord(project: ProjectData): StoredProjectRecord {
  return structuredClone({ ...project, storageVersion: 8 as const });
}

function isStoredProjectRecord(
  value: StoredProjectRecord | LegacyProjectData,
): value is StoredProjectRecord {
  return 'storageVersion' in value && value.storageVersion === 8;
}

export function migrateStoredProjectRecord(value: unknown): ProjectData {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('The saved project record is damaged.');
  }
  const record = value as Record<string, unknown>;
  if (record.storageVersion === 8 || record.storageVersion === 7) {
    const project = { ...record };
    delete project.storageVersion;
    return migrateProjectFile({
      format: 'mocknslice-project',
      version: record.storageVersion,
      project,
    }).project;
  }
  if (record.modeParameters && typeof record.modeParameters === 'object') {
    return migrateProjectFile({ format: 'mocknslice-project', version: 6, project: record })
      .project;
  }
  throw new Error('The saved project version is not supported.');
}

let databasePromise: Promise<IDBPDatabase<SliceFoldDatabase>> | undefined;

function getDatabase(): Promise<IDBPDatabase<SliceFoldDatabase>> {
  databasePromise ??= openDB<SliceFoldDatabase>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(database) {
      const projects = database.createObjectStore('projects', {
        keyPath: 'metadata.id',
      });
      projects.createIndex('by-updated-at', 'metadata.updatedAt');
      database.createObjectStore('settings');
    },
  });

  return databasePromise;
}

export class IndexedDbProjectRepository implements ProjectRepository {
  async save(project: ProjectData): Promise<void> {
    const database = await getDatabase();
    const transaction = database.transaction(['projects', 'settings'], 'readwrite');
    await transaction.objectStore('projects').put(createStoredProjectRecord(project));
    await transaction.objectStore('settings').put(project.metadata.id, LAST_AUTOSAVE_KEY);
    await transaction.done;
  }

  async get(id: string): Promise<ProjectData | undefined> {
    const database = await getDatabase();
    const record = await database.get('projects', id);
    if (!record) return undefined;
    const project = migrateStoredProjectRecord(record);
    if (!isStoredProjectRecord(record)) {
      await database.put('projects', createStoredProjectRecord(project));
    }
    return project;
  }

  async list(): Promise<ProjectMetadata[]> {
    const database = await getDatabase();
    const records = await database.getAllFromIndex('projects', 'by-updated-at');
    const projects = records.map(migrateStoredProjectRecord);
    const legacyProjects = records
      .map((record, index) => (isStoredProjectRecord(record) ? undefined : projects[index]))
      .filter((project): project is ProjectData => project !== undefined);
    if (legacyProjects.length) {
      const transaction = database.transaction('projects', 'readwrite');
      await Promise.all(
        legacyProjects.map((project) => transaction.store.put(createStoredProjectRecord(project))),
      );
      await transaction.done;
    }
    return projects.map((project) => project.metadata).reverse();
  }

  async delete(id: string): Promise<void> {
    const database = await getDatabase();
    await database.delete('projects', id);
  }

  async getLastAutosaved(): Promise<ProjectData | undefined> {
    const database = await getDatabase();
    const id = await database.get('settings', LAST_AUTOSAVE_KEY);
    if (!id) return undefined;
    const record = await database.get('projects', id);
    if (!record) return undefined;
    const project = migrateStoredProjectRecord(record);
    if (!isStoredProjectRecord(record)) {
      await database.put('projects', createStoredProjectRecord(project));
    }
    return project;
  }
}

export const projectRepository: ProjectRepository = new IndexedDbProjectRepository();
