import type { FabricationPart, SliceAxis } from '../../domain/fabrication';
import type {
  AssembledFoldPanel,
  FoldEdgeDefinition,
  FoldPanel,
  FoldTab,
  ProjectedProfile,
  TemplateFitSettings,
  TemplateGenerationResult,
  TemplateKind,
} from '../../domain/folding';
import type { Bounds3D, Point2D, SerializableTriangleMesh } from '../../domain/geometry';
import type { ValidationIssue } from '../../domain/validation';
import { intersectMeshWithPlane } from '../slicing/trianglePlaneIntersection';
import { buildFoldNet, rectangle, type HingeSpec, type TabSpec } from './netBuilder';
import {
  convexHull,
  deterministicFoldingHash,
  extractProjectedProfile,
  FOLDING_ALGORITHM_VERSION,
  offsetConvexPolygon,
  profilePointToWorld,
} from './profile';

export interface FoldTemplateInput {
  mesh: SerializableTriangleMesh;
  bounds: Bounds3D;
  modelId: string;
  materialThicknessMm: number;
  settings: TemplateFitSettings;
}

interface BuiltTemplate {
  panels: FoldPanel[];
  edges: FoldEdgeDefinition[];
  tabs: FoldTab[];
  parts: FabricationPart[];
  assembled: AssembledFoldPanel[];
  issues: ValidationIssue[];
}

function numberParameter(settings: TemplateFitSettings, name: string, fallback: number): number {
  const value = settings.parameters[name];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function bounds2(points: readonly Point2D[]) {
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
}

function centroid(points: readonly Point2D[]): Point2D {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function translated(points: readonly Point2D[], x: number, y: number): Point2D[] {
  return points.map((point) => ({ x: point.x + x, y: point.y + y }));
}

function rectanglePanel(
  id: string,
  partId: string,
  name: string,
  role: FoldPanel['role'],
  x: number,
  y: number,
  width: number,
  height: number,
): FoldPanel {
  return { id, partId, name, role, outline: rectangle(x, y, width, height) };
}

function worldPanel(
  id: string,
  partId: string,
  name: string,
  points: readonly Point2D[],
  axisPositions: readonly number[],
  fitAxis: SliceAxis,
): AssembledFoldPanel {
  return {
    id,
    partId,
    name,
    verticesMm: points.map((point, index) =>
      profilePointToWorld(point, axisPositions[index] ?? axisPositions[0] ?? 0, fitAxis),
    ),
  };
}

function mergeBuilt(...templates: BuiltTemplate[]): BuiltTemplate {
  return {
    panels: templates.flatMap((template) => template.panels),
    edges: templates.flatMap((template) => template.edges),
    tabs: templates.flatMap((template) => template.tabs),
    parts: templates.flatMap((template) => template.parts),
    assembled: templates.flatMap((template) => template.assembled),
    issues: templates.flatMap((template) => template.issues),
  };
}

function openBoxNet(input: {
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
    },
    {
      id: `${partId}-tab-left-top`,
      ownerPanelId: ids.left,
      start: { x, y: y + heightMm },
      end: { x: x - wallHeightMm, y: y + heightMm },
      depthMm: tabDepthMm,
    },
    {
      id: `${partId}-tab-right-bottom`,
      ownerPanelId: ids.right,
      start: { x: x + widthMm, y },
      end: { x: x + widthMm + wallHeightMm, y },
      depthMm: tabDepthMm,
    },
    {
      id: `${partId}-tab-right-top`,
      ownerPanelId: ids.right,
      start: { x: x + widthMm + wallHeightMm, y: y + heightMm },
      end: { x: x + widthMm, y: y + heightMm },
      depthMm: tabDepthMm,
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
    tabs: net.tabs,
    parts: [net.part],
    assembled,
    issues: net.issues,
  };
}

function bandNet(input: {
  profile: ProjectedProfile;
  settings: TemplateFitSettings;
  thicknessMm: number;
  partId: string;
  name: string;
  templateKind: TemplateKind;
  profilePoints: Point2D[];
  depthMm: number;
  seamTabMm: number;
  includeFaces: boolean;
  closureFlapMm?: number;
}): BuiltTemplate {
  const {
    profile,
    settings,
    thicknessMm,
    partId,
    name,
    templateKind,
    profilePoints,
    depthMm,
    seamTabMm,
    includeFaces,
    closureFlapMm = 0,
  } = input;
  const panels: FoldPanel[] = [];
  const hinges: HingeSpec[] = [];
  const tabs: TabSpec[] = [];
  const assembled: AssembledFoldPanel[] = [];
  let cursor = 0;
  profilePoints.forEach((point, index) => {
    const next = profilePoints[(index + 1) % profilePoints.length]!;
    const length = distance(point, next);
    const id = `${partId}-band-${index + 1}`;
    panels.push(
      rectanglePanel(id, partId, `Band ${index + 1}`, 'band', cursor, 0, length, depthMm),
    );
    if (index > 0) {
      hinges.push({
        id: `${partId}-band-fold-${index}`,
        panelAId: panels[index - 1]!.id,
        panelBId: id,
        start: { x: cursor, y: 0 },
        end: { x: cursor, y: depthMm },
        direction: 'valley',
        targetAngleDeg: 360 / profilePoints.length,
      });
    }
    assembled.push(
      worldPanel(
        id,
        partId,
        `Band ${index + 1}`,
        [point, next, next, point],
        [profile.axisMinMm, profile.axisMinMm, profile.axisMaxMm, profile.axisMaxMm],
        settings.fitAxis,
      ),
    );
    cursor += length;
  });
  const finalPanel = panels.at(-1)!;
  tabs.push({
    id: `${partId}-seam-tab`,
    ownerPanelId: finalPanel.id,
    start: { x: cursor, y: 0 },
    end: { x: cursor, y: depthMm },
    depthMm: seamTabMm,
  });

  if (includeFaces) {
    const firstLength = distance(profilePoints[0]!, profilePoints[1]!);
    const transformFace = (targetY: number, reflect: boolean): Point2D[] => {
      const sourceStart = profilePoints[0]!;
      const sourceEnd = profilePoints[1]!;
      const dx = sourceEnd.x - sourceStart.x;
      const dy = sourceEnd.y - sourceStart.y;
      const length = Math.hypot(dx, dy);
      const unit = { x: dx / length, y: dy / length };
      const left = { x: -unit.y, y: unit.x };
      return profilePoints.map((point) => {
        const relative = { x: point.x - sourceStart.x, y: point.y - sourceStart.y };
        const u = relative.x * unit.x + relative.y * unit.y;
        const v = relative.x * left.x + relative.y * left.y;
        return { x: u, y: targetY + (reflect ? -v : v) };
      });
    };
    const faceAId = `${partId}-face-a`;
    const faceBId = `${partId}-face-b`;
    panels.push({
      id: faceAId,
      partId,
      name: 'Front face',
      role: 'face',
      outline: transformFace(0, true),
    });
    panels.push({
      id: faceBId,
      partId,
      name: 'Back face',
      role: 'face',
      outline: transformFace(depthMm, false),
    });
    hinges.push(
      {
        id: `${partId}-face-a-fold`,
        panelAId: panels[0]!.id,
        panelBId: faceAId,
        start: { x: 0, y: 0 },
        end: { x: firstLength, y: 0 },
        direction: 'valley',
        targetAngleDeg: 90,
      },
      {
        id: `${partId}-face-b-fold`,
        panelAId: panels[0]!.id,
        panelBId: faceBId,
        start: { x: firstLength, y: depthMm },
        end: { x: 0, y: depthMm },
        direction: 'valley',
        targetAngleDeg: 90,
      },
    );
    if (closureFlapMm > 0) {
      const faceB = panels.at(-1)!;
      const start = faceB.outline[1]!;
      const end = faceB.outline[2]!;
      tabs.push({
        id: `${partId}-closure-flap`,
        ownerPanelId: faceBId,
        start,
        end,
        depthMm: closureFlapMm,
      });
    }
    assembled.push(
      worldPanel(
        faceAId,
        partId,
        'Front face',
        profilePoints,
        [profile.axisMinMm],
        settings.fitAxis,
      ),
      worldPanel(
        faceBId,
        partId,
        'Back face',
        profilePoints,
        [profile.axisMaxMm],
        settings.fitAxis,
      ),
    );
  }
  const net = buildFoldNet({ partId, name, templateKind, thicknessMm, panels, hinges, tabs });
  return {
    panels,
    edges: net.edges,
    tabs: net.tabs,
    parts: [net.part],
    assembled,
    issues: net.issues,
  };
}

function regularCircumscribedProfile(
  source: readonly Point2D[],
  sides: number,
  rotationDeg: number,
): Point2D[] {
  const centre = centroid(source);
  const rotation = (rotationDeg * Math.PI) / 180;
  let apothem = 0;
  for (let index = 0; index < sides; index += 1) {
    const normalAngle = rotation + ((index + 0.5) * Math.PI * 2) / sides;
    const normal = { x: Math.cos(normalAngle), y: Math.sin(normalAngle) };
    for (const point of source) {
      apothem = Math.max(
        apothem,
        (point.x - centre.x) * normal.x + (point.y - centre.y) * normal.y,
      );
    }
  }
  const radius = apothem / Math.cos(Math.PI / sides);
  return Array.from({ length: sides }, (_, index) => {
    const angle = rotation + (index * Math.PI * 2) / sides;
    return { x: centre.x + Math.cos(angle) * radius, y: centre.y + Math.sin(angle) * radius };
  });
}

function resamplePolygon(points: readonly Point2D[], count: number): Point2D[] {
  const lengths = points.map((point, index) =>
    distance(point, points[(index + 1) % points.length]!),
  );
  const perimeter = lengths.reduce((sum, length) => sum + length, 0);
  return Array.from({ length: count }, (_, sampleIndex) => {
    let target = (sampleIndex * perimeter) / count;
    for (let index = 0; index < points.length; index += 1) {
      const length = lengths[index]!;
      if (target <= length) {
        const start = points[index]!;
        const end = points[(index + 1) % points.length]!;
        const ratio = length === 0 ? 0 : target / length;
        return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio };
      }
      target -= length;
    }
    return { ...points[0]! };
  });
}

function sectionProfile(input: FoldTemplateInput, positionMm: number): Point2D[] | undefined {
  const intersection = intersectMeshWithPlane(
    input.mesh,
    input.settings.fitAxis,
    positionMm,
    0.001,
  );
  const hull = convexHull(intersection.segments.flatMap((segment) => [segment.start, segment.end]));
  return hull.length >= 3 ? offsetConvexPolygon(hull, input.settings.clearanceMm) : undefined;
}

function pyramidNet(input: FoldTemplateInput, profile: ProjectedProfile): BuiltTemplate {
  const topScale = Math.max(0, Math.min(1, numberParameter(input.settings, 'topScale', 0)));
  const tabDepthMm = Math.max(1, numberParameter(input.settings, 'seamTabMm', 8));
  const lowerSection =
    sectionProfile(input, profile.axisMinMm + profile.depthMm * 0.2) ?? profile.fittedPoints;
  const upperSection =
    sectionProfile(input, profile.axisMaxMm - profile.depthMm * 0.2) ?? profile.fittedPoints;
  const count = Math.max(3, Math.min(12, Math.max(lowerSection.length, upperSection.length)));
  const baseRaw = resamplePolygon(lowerSection, count);
  const upperRaw = resamplePolygon(upperSection, count);
  const upperCentre = centroid(upperRaw);
  const topRaw = upperRaw.map((point) => ({
    x: upperCentre.x + (point.x - upperCentre.x) * topScale,
    y: upperCentre.y + (point.y - upperCentre.y) * topScale,
  }));
  const baseBounds = bounds2(baseRaw);
  const margin = profile.depthMm + tabDepthMm + 4;
  const shift = { x: margin - baseBounds.minX, y: margin - baseBounds.minY };
  const base = translated(baseRaw, shift.x, shift.y);
  const partId = 'fold-pyramid-main';
  const baseId = `${partId}-base`;
  const panels: FoldPanel[] = [{ id: baseId, partId, name: 'Base', role: 'base', outline: base }];
  const hinges: HingeSpec[] = [];
  const tabs: TabSpec[] = [];
  const assembled: AssembledFoldPanel[] = [
    worldPanel(baseId, partId, 'Base', baseRaw, [profile.axisMinMm], input.settings.fitAxis),
  ];
  for (let index = 0; index < count; index += 1) {
    const baseStart = base[index]!;
    const baseEnd = base[(index + 1) % count]!;
    const topStart = topRaw[index]!;
    const topEnd = topRaw[(index + 1) % count]!;
    const bottomLength = distance(baseStart, baseEnd);
    const topLength = distance(topStart, topEnd);
    const radialStart = distance(baseRaw[index]!, topStart);
    const radialEnd = distance(baseRaw[(index + 1) % count]!, topEnd);
    const slant = Math.hypot(profile.depthMm, (radialStart + radialEnd) / 2);
    const height = Math.sqrt(Math.max(0.01, slant ** 2 - ((bottomLength - topLength) / 2) ** 2));
    const dx = baseEnd.x - baseStart.x;
    const dy = baseEnd.y - baseStart.y;
    const unit = { x: dx / bottomLength, y: dy / bottomLength };
    const outward = { x: unit.y, y: -unit.x };
    const inset = (bottomLength - topLength) / 2;
    const flatTopStart = {
      x: baseStart.x + unit.x * inset + outward.x * height,
      y: baseStart.y + unit.y * inset + outward.y * height,
    };
    const flatTopEnd = {
      x: flatTopStart.x + unit.x * topLength,
      y: flatTopStart.y + unit.y * topLength,
    };
    const id = `${partId}-side-${index + 1}`;
    panels.push({
      id,
      partId,
      name: `Side ${index + 1}`,
      role: 'side',
      outline: [baseEnd, baseStart, flatTopStart, flatTopEnd],
    });
    hinges.push({
      id: `${id}-base-fold`,
      panelAId: baseId,
      panelBId: id,
      start: baseStart,
      end: baseEnd,
      direction: 'valley',
      targetAngleDeg: 75,
    });
    tabs.push({
      id: `${id}-seam-tab`,
      ownerPanelId: id,
      start: flatTopEnd,
      end: baseEnd,
      depthMm: tabDepthMm,
    });
    assembled.push(
      worldPanel(
        id,
        partId,
        `Side ${index + 1}`,
        [baseRaw[index]!, baseRaw[(index + 1) % count]!, topEnd, topStart],
        [profile.axisMinMm, profile.axisMinMm, profile.axisMaxMm, profile.axisMaxMm],
        input.settings.fitAxis,
      ),
    );
  }
  const main = buildFoldNet({
    partId,
    name: topScale === 0 ? 'Pyramid net' : 'Frustum net',
    templateKind: 'pyramid-frustum',
    thicknessMm: input.materialThicknessMm,
    panels,
    hinges,
    tabs,
  });
  const built: BuiltTemplate = {
    panels,
    edges: main.edges,
    tabs: main.tabs,
    parts: [main.part],
    assembled,
    issues: main.issues,
  };
  if (topScale <= 0.000001) return built;

  const capPartId = 'fold-pyramid-cap';
  const capId = `${capPartId}-face`;
  const capBounds = bounds2(topRaw);
  const capOutline = translated(
    topRaw,
    -capBounds.minX + tabDepthMm + 2,
    -capBounds.minY + tabDepthMm + 2,
  );
  const capPanel: FoldPanel = {
    id: capId,
    partId: capPartId,
    name: 'Top cap',
    role: 'lid',
    outline: capOutline,
  };
  const capTabs: TabSpec[] = capOutline.map((point, index) => ({
    id: `${capPartId}-tab-${index + 1}`,
    ownerPanelId: capId,
    start: point,
    end: capOutline[(index + 1) % capOutline.length]!,
    depthMm: tabDepthMm,
  }));
  const cap = buildFoldNet({
    partId: capPartId,
    name: 'Frustum top cap',
    templateKind: 'pyramid-frustum',
    thicknessMm: input.materialThicknessMm,
    panels: [capPanel],
    hinges: [],
    tabs: capTabs,
  });
  return mergeBuilt(built, {
    panels: [capPanel],
    edges: cap.edges,
    tabs: cap.tabs,
    parts: [cap.part],
    assembled: [
      worldPanel(capId, capPartId, 'Top cap', topRaw, [profile.axisMaxMm], input.settings.fitAxis),
    ],
    issues: cap.issues,
  });
}

function incompatibleResult(
  input: FoldTemplateInput,
  issues: ValidationIssue[],
): TemplateGenerationResult {
  const extent: [number, number] =
    input.settings.fitAxis === 'x'
      ? [input.bounds.minMm[0], input.bounds.maxMm[0]]
      : input.settings.fitAxis === 'y'
        ? [input.bounds.minMm[1], input.bounds.maxMm[1]]
        : [input.bounds.minMm[2], input.bounds.maxMm[2]];
  return {
    settings: input.settings,
    profile: {
      sourceModelId: input.modelId,
      fitAxis: input.settings.fitAxis,
      sourceHullPoints: [],
      fittedPoints: [],
      clearanceMm: input.settings.clearanceMm,
      simplificationToleranceMm: input.settings.profileToleranceMm,
      axisMinMm: extent[0],
      axisMaxMm: extent[1],
      widthMm: 0,
      heightMm: 0,
      depthMm: extent[1] - extent[0],
    },
    panels: [],
    edges: [],
    tabs: [],
    parts: [],
    issues,
    assembledPreview: { panels: [] },
    algorithmVersion: FOLDING_ALGORITHM_VERSION,
    inputHash: deterministicFoldingHash({
      mesh: input.mesh,
      settings: input.settings,
      materialThicknessMm: input.materialThicknessMm,
    }),
  };
}

export function generateFoldTemplate(input: FoldTemplateInput): TemplateGenerationResult {
  if (input.settings.clearanceMm < 0 || input.settings.profileToleranceMm <= 0) {
    return incompatibleResult(input, [
      {
        id: `template-invalid-settings-${input.modelId}`,
        severity: 'error',
        code: 'TEMPLATE_INCOMPATIBLE',
        message: 'Clearance must be non-negative and profile tolerance must be positive.',
        affectedEntityIds: [input.modelId],
        suggestedAction: 'Correct the fit settings and generate again.',
      },
    ]);
  }
  const extracted = extractProjectedProfile({ ...input, settings: input.settings });
  if (!extracted.profile) return incompatibleResult(input, extracted.issues);
  const profile = extracted.profile;
  if (extracted.issues.some((issue) => issue.severity === 'error')) {
    return { ...incompatibleResult(input, extracted.issues), profile };
  }
  const profileExtent = bounds2(profile.fittedPoints);
  const centre = {
    x: (profileExtent.minX + profileExtent.maxX) / 2,
    y: (profileExtent.minY + profileExtent.maxY) / 2,
  };
  const tabDepthMm = Math.max(1, numberParameter(input.settings, 'tabDepthMm', 8));
  const wallHeightMm = Math.max(
    1,
    numberParameter(input.settings, 'wallHeightMm', profile.depthMm),
  );
  let built: BuiltTemplate;
  if (input.settings.templateKind === 'open-box' || input.settings.templateKind === 'tray') {
    built = openBoxNet({
      profile,
      settings: input.settings,
      thicknessMm: input.materialThicknessMm,
      partId: `fold-${input.settings.templateKind}-main`,
      name: input.settings.templateKind === 'tray' ? 'Tray net' : 'Open box net',
      templateKind: input.settings.templateKind,
      widthMm: profile.widthMm,
      heightMm: profile.heightMm,
      wallHeightMm,
      tabDepthMm,
      centre,
      axisBaseMm: profile.axisMinMm,
      axisDirection: 1,
    });
  } else if (input.settings.templateKind === 'box-with-lid') {
    const base = openBoxNet({
      profile,
      settings: input.settings,
      thicknessMm: input.materialThicknessMm,
      partId: 'fold-box-base',
      name: 'Box base net',
      templateKind: 'box-with-lid',
      widthMm: profile.widthMm,
      heightMm: profile.heightMm,
      wallHeightMm,
      tabDepthMm,
      centre,
      axisBaseMm: profile.axisMinMm,
      axisDirection: 1,
    });
    const lidClearance = Math.max(0, numberParameter(input.settings, 'lidClearanceMm', 0.5));
    const lidDepth = Math.max(1, numberParameter(input.settings, 'lidDepthMm', 15));
    const enlargement = (input.materialThicknessMm + lidClearance) * 2;
    const lid = openBoxNet({
      profile,
      settings: input.settings,
      thicknessMm: input.materialThicknessMm,
      partId: 'fold-box-lid',
      name: 'Box lid net',
      templateKind: 'box-with-lid',
      widthMm: profile.widthMm + enlargement,
      heightMm: profile.heightMm + enlargement,
      wallHeightMm: lidDepth,
      tabDepthMm,
      centre,
      axisBaseMm: profile.axisMaxMm + input.materialThicknessMm,
      axisDirection: -1,
      role: 'lid',
    });
    built = mergeBuilt(base, lid);
  } else if (input.settings.templateKind === 'sleeve') {
    built = bandNet({
      profile,
      settings: input.settings,
      thicknessMm: input.materialThicknessMm,
      partId: 'fold-sleeve-main',
      name: 'Sleeve net',
      templateKind: 'sleeve',
      profilePoints: profile.fittedPoints,
      depthMm: profile.depthMm,
      seamTabMm: Math.max(1, numberParameter(input.settings, 'seamTabMm', 8)),
      includeFaces: false,
    });
  } else if (input.settings.templateKind === 'envelope') {
    built = bandNet({
      profile,
      settings: input.settings,
      thicknessMm: input.materialThicknessMm,
      partId: 'fold-envelope-main',
      name: 'Envelope net',
      templateKind: 'envelope',
      profilePoints: profile.fittedPoints,
      depthMm: Math.max(
        profile.depthMm,
        numberParameter(input.settings, 'gussetDepthMm', profile.depthMm),
      ),
      seamTabMm: Math.max(1, numberParameter(input.settings, 'seamTabMm', 8)),
      includeFaces: true,
      closureFlapMm: Math.max(0, numberParameter(input.settings, 'closureFlapMm', 12)),
    });
  } else if (input.settings.templateKind === 'regular-prism') {
    const sides = Math.max(
      3,
      Math.min(12, Math.round(numberParameter(input.settings, 'prismSides', 6))),
    );
    const polygon = regularCircumscribedProfile(
      profile.fittedPoints,
      sides,
      numberParameter(input.settings, 'prismRotationDeg', 0),
    );
    built = bandNet({
      profile,
      settings: input.settings,
      thicknessMm: input.materialThicknessMm,
      partId: 'fold-prism-main',
      name: `${sides}-sided prism net`,
      templateKind: 'regular-prism',
      profilePoints: polygon,
      depthMm: profile.depthMm,
      seamTabMm: Math.max(1, numberParameter(input.settings, 'seamTabMm', 8)),
      includeFaces: true,
    });
  } else {
    built = pyramidNet(input, profile);
  }
  const issues = [...extracted.issues, ...built.issues];
  if (
    wallHeightMm < profile.depthMm &&
    ['open-box', 'box-with-lid'].includes(input.settings.templateKind)
  ) {
    issues.push({
      id: `template-wall-short-${input.modelId}`,
      severity: 'warning',
      code: 'TEMPLATE_INCOMPATIBLE',
      message: 'The selected wall height is shorter than the model depth.',
      affectedEntityIds: [input.modelId],
      suggestedAction: 'Increase wall height to fully contain the model.',
    });
  }
  return {
    settings: input.settings,
    profile,
    panels: built.panels,
    edges: built.edges,
    tabs: built.tabs,
    parts: built.parts,
    issues,
    assembledPreview: { panels: built.assembled },
    algorithmVersion: FOLDING_ALGORITHM_VERSION,
    inputHash: deterministicFoldingHash({
      mesh: input.mesh,
      settings: input.settings,
      materialThicknessMm: input.materialThicknessMm,
    }),
  };
}
