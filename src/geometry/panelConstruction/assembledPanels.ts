import type {
  PanelConstructionPanel,
  PanelConstructionSettings,
  PanelRole,
} from '../../domain/panelConstruction';
import type { FabricationPart } from '../../domain/fabrication';
import type { AssembledFoldPanel } from '../../domain/folding';
import type { Point2D, Vector3Mm } from '../../domain/geometry';
import type { PanelSpec } from './constructionTypes';

export function assembledPanels(
  settings: PanelConstructionSettings,
  panels: readonly PanelConstructionPanel[],
  parts: readonly FabricationPart[],
  specs: readonly PanelSpec[],
): AssembledFoldPanel[] {
  const halfWidth = settings.innerWidthMm / 2;
  const halfDepth = settings.innerDepthMm / 2;
  const height = settings.innerHeightMm;
  const specsByRole = new Map(specs.map((spec) => [spec.role, spec]));
  const toWorld = (role: PanelRole, point: Point2D): Vector3Mm => {
    if (role === 'base') return [point.x, 0, point.y];
    if (role === 'front') return [point.x, point.y + height / 2, -halfDepth];
    if (role === 'back') return [-point.x, point.y + height / 2, halfDepth];
    if (role === 'left') return [-halfWidth, point.y + height / 2, -point.x];
    if (role === 'right') return [halfWidth, point.y + height / 2, point.x];
    if (role === 'lid') return [point.x, height, -point.y];
    const spec = specsByRole.get(role);
    const position = spec?.dividerPositionMm ?? 0;
    return spec?.dividerAxis === 'width'
      ? [point.x, point.y + height / 2, position]
      : [position, point.y + height / 2, point.x];
  };
  return panels.map((panel) => {
    const part = parts.find((candidate) => candidate.id === panel.partId);
    const holes =
      part?.paths
        .filter((path) => path.contourRole === 'hole')
        .map((path) => path.points.map((point) => toWorld(panel.role, point))) ?? [];
    return {
      id: panel.id,
      partId: panel.partId,
      name: panel.name,
      verticesMm: panel.outline.map((point) => toWorld(panel.role, point)),
      ...(holes.length > 0 ? { holesVerticesMm: holes } : {}),
    };
  });
}
