import { type DBSchema, type IDBPDatabase, openDB } from 'idb';
import type { ProjectData, ProjectMetadata } from '../domain/project';
import type { ProjectRepository } from './projectRepository';

const DATABASE_NAME = 'slicefold';
const DATABASE_VERSION = 1;
const LAST_AUTOSAVE_KEY = 'last-autosave-project-id';

interface SliceFoldDatabase extends DBSchema {
  projects: {
    key: string;
    value: ProjectData;
    indexes: { 'by-updated-at': string };
  };
  settings: {
    key: string;
    value: string;
  };
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
    await transaction.objectStore('projects').put(structuredClone(project));
    await transaction.objectStore('settings').put(project.metadata.id, LAST_AUTOSAVE_KEY);
    await transaction.done;
  }

  async get(id: string): Promise<ProjectData | undefined> {
    const database = await getDatabase();
    return database.get('projects', id);
  }

  async list(): Promise<ProjectMetadata[]> {
    const database = await getDatabase();
    const projects = await database.getAllFromIndex('projects', 'by-updated-at');
    return projects.map((project) => project.metadata).reverse();
  }

  async delete(id: string): Promise<void> {
    const database = await getDatabase();
    await database.delete('projects', id);
  }

  async getLastAutosaved(): Promise<ProjectData | undefined> {
    const database = await getDatabase();
    const id = await database.get('settings', LAST_AUTOSAVE_KEY);
    return id ? database.get('projects', id) : undefined;
  }
}

export const projectRepository: ProjectRepository = new IndexedDbProjectRepository();
