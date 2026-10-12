import type {
  AssembledFoldPanel,
  FoldPanel,
  ProjectedProfile,
  TemplateFitSettings,
  TemplateKind,
} from '../../domain/folding';
import type { Point2D } from '../../domain/geometry';
import { buildFoldNet, type HingeSpec, type TabSpec } from '../../geometry/folding/netBuilder';
import {
  closureForSettings,
  rectanglePanel,
  worldPanel,
} from '../../geometry/folding/templateHelpers';
import type { BuiltTemplate } from '../../geometry/folding/templateTypes';

export function openBoxNet(input: {
  profile: ProjectedProfile;
  settings: TemplateFitSettings;
  thicknessMm: number;
  partId: string;
  name: string;
  templateKind: TemplateKind;
  widthMm: number;
  heightMm: number;
  wallHeightMm: number;
  tabDepthMm: number;
  centre: Point2D;
  axisBaseMm: number;
  axisDirection: 1 | -1;
  role?: 'base' | 'lid';
}): BuiltTemplate {
  const {
    settings,
    thicknessMm,
    partId,
    name,
    templateKind,
    widthMm,
    heightMm,
    wallHeightMm,
    tabDepthMm,
    centre,
    axisBaseMm,
    axisDirection,
    role = 'base',
  } = input;
  const x = wallHeightMm + tabDepthMm + 2;
  const y = wallHeightMm + tabDepthMm + 2;
  const ids = {
    base: `${partId}-${role}`,
    bottom: `${partId}-wall-bottom`,
    right: `${partId}-wall-right`,
    top: `${partId}-wall-top`,
    left: `${partId}-wall-left`,
  };
  const panels: FoldPanel[] = [
    rectanglePanel(
      ids.base,
      partId,
      role === 'lid' ? 'Lid face' : 'Base',
      role,
      x,
      y,
      widthMm,
      heightMm,
    ),
    rectanglePanel(
      ids.bottom,
      partId,
      'Bottom wall',
      'wall',
      x,
      y - wallHeightMm,
      widthMm,
      wallHeightMm,
    ),
    rectanglePanel(ids.right, partId, 'Right wall', 'wall', x + widthMm, y, wallHeightMm, heightMm),
    rectanglePanel(ids.top, partId, 'Top wall', 'wall', x, y + heightMm, widthMm, wallHeightMm),
    rectanglePanel(
      ids.left,
      partId,
      'Left wall',
      'wall',
      x - wallHeightMm,
      y,
      wallHeightMm,
      heightMm,
    ),
  ];
  const hinges: HingeSpec[] = [
    {
      id: `${partId}-fold-bottom`,
      panelAId: ids.base,
      panelBId: ids.bottom,
      start: { x, y },
      end: { x: x + widthMm, y },
      direction: 'valley',
      targetAngleDeg: 90,
    },
    {
      id: `${partId}-fold-right`,
      panelAId: ids.base,
      panelBId: ids.right,
      start: { x: x + widthMm, y },
      end: { x: x + widthMm, y: y + heightMm },
      direction: 'valley',
      targetAngleDeg: 90,
    },
    {
      id: `${partId}-fold-top`,
      panelAId: ids.base,
      panelBId: ids.top,
      start: { x: x + widthMm, y: y + heightMm },
      end: { x, y: y + heightMm },
      direction: 'valley',
      targetAngleDeg: 90,
    },
    {
      id: `${partId}-fold-left`,
      panelAId: ids.base,
      panelBId: ids.left,
      start: { x, y: y + heightMm },
      end: { x, y },
      direction: 'valley',
      targetAngleDeg: 90,
    },
  ];
  const tabs: TabSpec[] = [
    {
      id: `${partId}-tab-left-bottom`,
      ownerPanelId: ids.left,
      start: { x: x - wallHeightMm, y },
      end: { x, y },
      depthMm: tabDepthMm,
      ...closureForSettings(settings),
      receiverPanelId: ids.bottom,
      receiverStart: { x, y: y - wallHeightMm },
      receiverEnd: { x, y },
    },
    {
      id: `${partId}-tab-left-top`,
      ownerPanelId: ids.left,
      start: { x, y: y + heightMm },
      end: { x: x - wallHeightMm, y: y + heightMm },
      depthMm: tabDepthMm,
      ...closureForSettings(settings),
      receiverPanelId: ids.top,
      receiverStart: { x, y: y + heightMm },
      receiverEnd: { x, y: y + heightMm + wallHeightMm },
    },
    {
      id: `${partId}-tab-right-bottom`,
      ownerPanelId: ids.right,
      start: { x: x + widthMm, y },
      end: { x: x + widthMm + wallHeightMm, y },
      depthMm: tabDepthMm,
      ...closureForSettings(settings),
      receiverPanelId: ids.bottom,
      receiverStart: { x: x + widthMm, y },
      receiverEnd: { x: x + widthMm, y: y - wallHeightMm },
    },
    {
      id: `${partId}-tab-right-top`,
      ownerPanelId: ids.right,
      start: { x: x + widthMm + wallHeightMm, y: y + heightMm },
      end: { x: x + widthMm, y: y + heightMm },
      depthMm: tabDepthMm,
      ...closureForSettings(settings),
      receiverPanelId: ids.top,
      receiverStart: { x: x + widthMm, y: y + heightMm + wallHeightMm },
      receiverEnd: { x: x + widthMm, y: y + heightMm },
    },
  ];
  const net = buildFoldNet({ partId, name, templateKind, thicknessMm, panels, hinges, tabs });
  const minX = centre.x - widthMm / 2;
  const maxX = centre.x + widthMm / 2;
  const minY = centre.y - heightMm / 2;
  const maxY = centre.y + heightMm / 2;
  const axisTop = axisBaseMm + wallHeightMm * axisDirection;
  const assembled: AssembledFoldPanel[] = [
    worldPanel(
      ids.base,
      partId,
      role === 'lid' ? 'Lid face' : 'Base',
      [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ],
      [axisBaseMm],
      settings.fitAxis,
    ),
    worldPanel(
      ids.bottom,
      partId,
      'Bottom wall',
      [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: minY },
        { x: minX, y: minY },
      ],
      [axisBaseMm, axisBaseMm, axisTop, axisTop],
      settings.fitAxis,
    ),
    worldPanel(
      ids.right,
      partId,
      'Right wall',
      [
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: maxX, y: maxY },
        { x: maxX, y: minY },
      ],
      [axisBaseMm, axisBaseMm, axisTop, axisTop],
      settings.fitAxis,
    ),
    worldPanel(
      ids.top,
      partId,
      'Top wall',
      [
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
        { x: minX, y: maxY },
        { x: maxX, y: maxY },
      ],
      [axisBaseMm, axisBaseMm, axisTop, axisTop],
      settings.fitAxis,
    ),
    worldPanel(
      ids.left,
      partId,
      'Left wall',
      [
        { x: minX, y: maxY },
        { x: minX, y: minY },
        { x: minX, y: minY },
        { x: minX, y: maxY },
      ],
      [axisBaseMm, axisBaseMm, axisTop, axisTop],
      settings.fitAxis,
    ),
  ];
  return {
    panels,
    edges: net.edges,
    connections: net.connections,
    tabs: net.tabs,
    parts: [net.part],
    assembled,
    issues: net.issues,
  };
}
