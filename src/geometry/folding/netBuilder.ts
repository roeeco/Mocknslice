import type { FabricationPart } from '../../domain/fabrication';
import type {
  FoldClosureMethod,
  FoldEdgeDefinition,
  FoldPanel,
  FoldTab,
  TemplateKind,
} from '../../domain/folding';
import type { Point2D } from '../../domain/geometry';
import type { ValidationIssue } from '../../domain/validation';

export interface HingeSpec {
  id: string;
  panelAId: string;
  panelBId?: string;
  start: Point2D;
  end: Point2D;
  direction: 'mountain' | 'valley';
  targetAngleDeg: number;
}

export interface TabSpec {
  id: string;
  ownerPanelId: string;
  start: Point2D;
  end: Point2D;
  depthMm: number;
  style?: FoldClosureMethod;
  receiverPanelId?: string;
  receiverStart?: Point2D;
  receiverEnd?: Point2D;
  slotClearanceMm?: number;
  emitSlot?: boolean;
}

function rounded(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundedPoint(point: Point2D): Point2D {
  return { x: rounded(point.x), y: rounded(point.y) };
}

function samePoint(a: Point2D, b: Point2D): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= 1e-5;
}

function sameSegment(aStart: Point2D, aEnd: Point2D, bStart: Point2D, bEnd: Point2D) {
  return (
    (samePoint(aStart, bStart) && samePoint(aEnd, bEnd)) ||
    (samePoint(aStart, bEnd) && samePoint(aEnd, bStart))
  );
}

function centroid(points: readonly Point2D[]): Point2D {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function tabOutline(spec: TabSpec, depthMm: number, thicknessMm: number): Point2D[] {
  const dx = spec.end.x - spec.start.x;
  const dy = spec.end.y - spec.start.y;
  const length = Math.hypot(dx, dy);
  const unit = { x: dx / length, y: dy / length };
  const outward = { x: unit.y, y: -unit.x };
  const inset =
    spec.style === 'press-fit'
      ? Math.max(length * 0.18, Math.min(length * 0.32, thicknessMm * 2))
      : Math.min(depthMm * 0.35, length * 0.2);
  return [
    spec.start,
    {
      x: spec.start.x + unit.x * inset + outward.x * depthMm,
      y: spec.start.y + unit.y * inset + outward.y * depthMm,
    },
    {
      x: spec.end.x - unit.x * inset + outward.x * depthMm,
      y: spec.end.y - unit.y * inset + outward.y * depthMm,
    },
    spec.end,
  ].map(roundedPoint);
}

function centredSlot(
  start: Point2D,
  end: Point2D,
  tabBaseLength: number,
  thicknessMm: number,
  clearanceMm: number,
): { start: Point2D; end: Point2D } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const receiverLength = Math.hypot(dx, dy);
  const unit = { x: dx / receiverLength, y: dy / receiverLength };
  const inset = Math.max(tabBaseLength * 0.18, Math.min(tabBaseLength * 0.32, thicknessMm * 2));
  const tongueLength = Math.min(receiverLength, tabBaseLength - inset * 2 + clearanceMm * 2);
  const centre = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  return {
    start: roundedPoint({
      x: centre.x - unit.x * (tongueLength / 2),
      y: centre.y - unit.y * (tongueLength / 2),
    }),
    end: roundedPoint({
      x: centre.x + unit.x * (tongueLength / 2),
      y: centre.y + unit.y * (tongueLength / 2),
    }),
  };
}

function projection(points: readonly Point2D[], axis: Point2D): { min: number; max: number } {
  const values = points.map((point) => point.x * axis.x + point.y * axis.y);
  return { min: Math.min(...values), max: Math.max(...values) };
}

function overlapAreaPossible(first: readonly Point2D[], second: readonly Point2D[]): boolean {
  const axes = [...first, ...second].map((point, index) => {
    const source = index < first.length ? first : second;
    const localIndex = index < first.length ? index : index - first.length;
    const start = source[localIndex]!;
    const end = source[(localIndex + 1) % source.length]!;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: -dy / length, y: dx / length };
  });
  return axes.every((axis) => {
    const a = projection(first, axis);
    const b = projection(second, axis);
    return Math.min(a.max, b.max) - Math.max(a.min, b.min) > 1e-5;
  });
}

export function buildFoldNet(input: {
  partId: string;
  name: string;
  templateKind: TemplateKind;
  thicknessMm: number;
  panels: FoldPanel[];
  hinges: HingeSpec[];
  tabs: TabSpec[];
}): {
  part: FabricationPart;
  edges: FoldEdgeDefinition[];
  tabs: FoldTab[];
  issues: ValidationIssue[];
} {
  const { partId, name, templateKind, thicknessMm, panels, hinges, tabs } = input;
  const edges: FoldEdgeDefinition[] = hinges.map((hinge, index) => ({
    id: hinge.id,
    partId,
    panelAId: hinge.panelAId,
    ...(hinge.panelBId ? { panelBId: hinge.panelBId } : {}),
    disposition: 'hinge',
    foldDirection: hinge.direction,
    targetAngleDeg: hinge.targetAngleDeg,
    pairLabel: `F${index + 1}`,
    start: roundedPoint(hinge.start),
    end: roundedPoint(hinge.end),
  }));
  const issues: ValidationIssue[] = [];
  const foldTabs: FoldTab[] = tabs.map((tab) => {
    const baseLength = Math.hypot(tab.end.x - tab.start.x, tab.end.y - tab.start.y);
    const maximumDepth = Math.max(0.5, Math.min(baseLength * 0.35, 15));
    const depthMm = Math.max(0.5, Math.min(tab.depthMm, maximumDepth));
    if (depthMm + 1e-6 < tab.depthMm) {
      issues.push({
        id: `tab-depth-clamped-${tab.id}`,
        severity: 'warning',
        code: 'TAB_DEPTH_CLAMPED',
        message: `Tab ${tab.id} was reduced from ${rounded(tab.depthMm)} mm to ${rounded(depthMm)} mm to fit its edge.`,
        affectedEntityIds: [partId, tab.id, tab.ownerPanelId],
        suggestedAction: 'Review the adjusted tab before fabrication.',
      });
    }
    const style = tab.style ?? 'glue';
    const slotClearanceMm = Math.max(0, tab.slotClearanceMm ?? 0);
    if (style === 'press-fit' && slotClearanceMm >= baseLength * 0.25) {
      issues.push({
        id: `press-fit-clearance-large-${tab.id}`,
        severity: 'error',
        code: 'PRESS_FIT_CLEARANCE_TOO_LARGE',
        message: `Press-fit clearance for ${tab.id} is too large for its receiving edge.`,
        affectedEntityIds: [partId, tab.id],
        suggestedAction: 'Reduce slit clearance or increase the connected edge length.',
      });
    }
    const receiverSlot =
      style === 'press-fit' && tab.receiverStart && tab.receiverEnd
        ? centredSlot(tab.receiverStart, tab.receiverEnd, baseLength, thicknessMm, slotClearanceMm)
        : undefined;
    if (style === 'press-fit' && (!tab.receiverPanelId || !receiverSlot)) {
      issues.push({
        id: `press-fit-receiver-missing-${tab.id}`,
        severity: 'error',
        code: 'PRESS_FIT_RECEIVER_MISSING',
        message: `Press-fit tab ${tab.id} has no receiving panel or slit.`,
        affectedEntityIds: [partId, tab.id],
        suggestedAction: 'Use glue closure or choose a template with a valid receiving face.',
      });
    }
    return {
      id: tab.id,
      partId,
      edgeId: `${tab.id}-base`,
      ownerPanelId: tab.ownerPanelId,
      style,
      depthMm: rounded(depthMm),
      shoulderAngleDeg: style === 'press-fit' ? 12 : 20,
      enabled: true,
      baseStart: roundedPoint(tab.start),
      baseEnd: roundedPoint(tab.end),
      outline: tabOutline(tab, depthMm, thicknessMm),
      ...(tab.receiverPanelId ? { receiverPanelId: tab.receiverPanelId } : {}),
      ...(receiverSlot ? { slotStart: receiverSlot.start, slotEnd: receiverSlot.end } : {}),
    };
  });

  const paths: FabricationPart['paths'] = [];
  for (const panel of panels) {
    panel.outline.forEach((start, index) => {
      const end = panel.outline[(index + 1) % panel.outline.length]!;
      if (hinges.some((hinge) => sameSegment(start, end, hinge.start, hinge.end))) return;
      if (tabs.some((tab) => sameSegment(start, end, tab.start, tab.end))) return;
      const edgeId = `${panel.id}-boundary-${index + 1}`;
      edges.push({
        id: edgeId,
        partId,
        panelAId: panel.id,
        disposition: 'boundary',
        start: roundedPoint(start),
        end: roundedPoint(end),
      });
      paths.push({
        id: `${edgeId}-cut`,
        operation: 'cut',
        closed: false,
        points: [roundedPoint(start), roundedPoint(end)],
        panelId: panel.id,
        edgeId,
      });
    });
  }
  for (const edge of edges.filter((candidate) => candidate.disposition === 'hinge')) {
    paths.push({
      id: `${edge.id}-fold`,
      operation: edge.foldDirection === 'mountain' ? 'mountain-fold' : 'valley-fold',
      closed: false,
      points: [edge.start, edge.end],
      panelId: edge.panelAId,
      edgeId: edge.id,
    });
  }
  for (const tab of foldTabs) {
    paths.push({
      id: `${tab.id}-cut`,
      operation: 'cut',
      closed: false,
      points: tab.outline,
      panelId: tab.ownerPanelId,
      tabId: tab.id,
    });
    paths.push({
      id: `${tab.id}-fold`,
      operation: 'score',
      closed: false,
      points: [tab.baseStart, tab.baseEnd],
      panelId: tab.ownerPanelId,
      tabId: tab.id,
      edgeId: tab.edgeId,
    });
    edges.push({
      id: tab.edgeId,
      partId,
      panelAId: tab.ownerPanelId,
      disposition: 'seam',
      foldDirection: 'valley',
      targetAngleDeg: 90,
      pairLabel: `T${foldTabs.indexOf(tab) + 1}`,
      start: tab.baseStart,
      end: tab.baseEnd,
    });
    const sourceSpec = tabs.find((candidate) => candidate.id === tab.id);
    if (
      tab.style === 'press-fit' &&
      tab.receiverPanelId &&
      tab.slotStart &&
      tab.slotEnd &&
      sourceSpec?.emitSlot !== false
    ) {
      paths.push({
        id: `${tab.id}-receiver-slit`,
        operation: 'cut',
        closed: false,
        points: [tab.slotStart, tab.slotEnd],
        panelId: tab.receiverPanelId,
        tabId: tab.id,
        edgeId: tab.edgeId,
      });
    }
  }

  for (let first = 0; first < panels.length; first += 1) {
    for (let second = first + 1; second < panels.length; second += 1) {
      const a = panels[first]!;
      const b = panels[second]!;
      if (!overlapAreaPossible(a.outline, b.outline)) continue;
      issues.push({
        id: `net-overlap-${a.id}-${b.id}`,
        severity: 'warning',
        code: 'NET_OVERLAP',
        message: `${a.name} overlaps ${b.name} in the generated flat net.`,
        affectedEntityIds: [partId, a.id, b.id],
        suggestedAction: 'Choose another template or adjust its dimensions.',
      });
    }
  }
  for (const tab of foldTabs) {
    for (const panel of panels.filter((candidate) => candidate.id !== tab.ownerPanelId)) {
      if (!overlapAreaPossible(tab.outline, panel.outline)) continue;
      issues.push({
        id: `tab-overlap-${tab.id}-${panel.id}`,
        severity: 'warning',
        code: 'TAB_OVERLAP',
        message: `${tab.style === 'press-fit' ? 'Press-fit' : 'Glue'} tab ${tab.id} overlaps ${panel.name}.`,
        affectedEntityIds: [partId, tab.id, panel.id],
        suggestedAction: 'Reduce tab depth or adjust the template dimensions.',
      });
    }
  }
  const labels = panels.map((panel) => ({
    id: `${panel.id}-label`,
    text: panel.name,
    position: roundedPoint(centroid(panel.outline)),
    operation: 'engrave' as const,
    entityId: panel.id,
  }));
  return {
    part: {
      id: partId,
      name,
      label: name,
      paths,
      labels,
      thicknessMm,
      folding: { templateKind, panelIds: panels.map((panel) => panel.id) },
    },
    edges,
    tabs: foldTabs,
    issues,
  };
}

export function rectangle(x: number, y: number, width: number, height: number): Point2D[] {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}
