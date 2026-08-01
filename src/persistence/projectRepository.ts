import type { ProjectData, ProjectMetadata } from '../domain/project';

export interface ProjectRepository {
  save(project: ProjectData): Promise<void>;
  get(id: string): Promise<ProjectData | undefined>;
  list(): Promise<ProjectMetadata[]>;
  delete(id: string): Promise<void>;
  getLastAutosaved(): Promise<ProjectData | undefined>;
}
