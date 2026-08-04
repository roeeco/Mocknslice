import { BRAND } from '../config/brand';
import type { MocknSliceProjectFileV6, ProjectData } from '../domain/project';

export const CURRENT_PROJECT_FILE_VERSION = 6 as const;

export function serializeProject(project: ProjectData): string {
  const file: MocknSliceProjectFileV6 = {
    format: 'mocknslice-project',
    version: CURRENT_PROJECT_FILE_VERSION,
    project,
  };

  return JSON.stringify(file, null, 2);
}

export function createProjectDownload(project: ProjectData): void {
  const blob = new Blob([serializeProject(project)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const safeName = project.metadata.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  anchor.href = url;
  anchor.download = `${safeName || 'mocknslice-project'}${BRAND.projectExtension}`;
  anchor.click();
  URL.revokeObjectURL(url);
}
