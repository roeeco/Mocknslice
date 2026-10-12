import type { FabricationPart } from '../../domain/fabrication';
import type {
  PanelConstructionJoint,
  PanelConstructionPanel,
  PanelConstructionSettings,
  PanelConstructionMaterial,
  PanelJointLocation,
} from '../../domain/panelConstruction';
import type { Point2D } from '../../domain/geometry';
import type { ValidationIssue } from '../../domain/validation';
import { edgeGeometry } from './fingerJoints';
import { thicknessForRole } from './constructionHelpers';
import { EPS_LENGTH_MM } from '../designGraph/tolerances';
import { outputIssue, canonicalizeContours } from '../output/canonicalizeContours';

function sharedEdge(
  panel: PanelConstructionPanel,
  edge: Exclude<PanelJointLocation, 'face'>,
  length: number,
) {
  const base = edgeGeometry(edge, panel.widthMm, panel.heightMm),
    full = Math.hypot(base.end.x - base.start.x, base.end.y - base.start.y),
    u = { x: (base.end.x - base.start.x) / full, y: (base.end.y - base.start.y) / full },
    centre = { x: (base.start.x + base.end.x) / 2, y: (base.start.y + base.end.y) / 2 };
  return {
    ...base,
    u,
    start: { x: centre.x - (u.x * length) / 2, y: centre.y - (u.y * length) / 2 },
    end: { x: centre.x + (u.x * length) / 2, y: centre.y + (u.y * length) / 2 },
  };
}
function reliefAt(
  panel: PanelConstructionPanel,
  edge: Exclude<PanelJointLocation, 'face'>,
  sharedLength: number,
  fraction: number,
  maximumDepth: number,
): number | undefined {
  const geometry = sharedEdge(panel, edge, sharedLength),
    p = {
      x: geometry.start.x + (geometry.end.x - geometry.start.x) * fraction,
      y: geometry.start.y + (geometry.end.y - geometry.start.y) * fraction,
    },
    hits: number[] = [];
  for (let i = 0; i < panel.outline.length; i++) {
    const a = panel.outline[i]!,
      b = panel.outline[(i + 1) % panel.outline.length]!,
      along = (v: Point2D) => (v.x - p.x) * geometry.u.x + (v.y - p.y) * geometry.u.y,
      first = along(a),
      second = along(b);
    if (first * second > 0 || Math.abs(first - second) <= EPS_LENGTH_MM) continue;
    const ratio = first / (first - second),
      point = { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio },
      normal = (point.x - p.x) * geometry.outward.x + (point.y - p.y) * geometry.outward.y;
    if (Math.abs(normal) <= maximumDepth + EPS_LENGTH_MM) hits.push(normal);
  }
  return hits.sort((a, b) => Math.abs(a) - Math.abs(b))[0];
}
/** Validate source joints before their panels are transformed into crease components. */
export function validateReciprocalJoints(
  settings: PanelConstructionSettings,
  material: PanelConstructionMaterial,
  panels: PanelConstructionPanel[],
  joints: PanelConstructionJoint[],
  parts: FabricationPart[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [],
    byId = new Map(panels.map((p) => [p.id, p])),
    ids = new Set<string>();
  for (const joint of joints) {
    const a = byId.get(joint.panelAId),
      b = byId.get(joint.panelBId);
    if (ids.has(joint.id) || !a || !b || a.id === b.id) {
      issues.push(
        outputIssue(
          'PANEL_JOINT_REFERENCE_INVALID',
          [joint.id, joint.panelAId, joint.panelBId],
          'Joint needs two distinct extant panels and a unique ID.',
        ),
      );
      continue;
    }
    ids.add(joint.id);
    const stockA = thicknessForRole(a.role, settings, material),
      stockB = thicknessForRole(b.role, settings, material);
    if (
      ![stockA, stockB, joint.sharedLengthMm].every((v) => Number.isFinite(v) && v > 0) ||
      !Number.isFinite(joint.clearanceMm) ||
      joint.clearanceMm < 0
    )
      issues.push(
        outputIssue(
          'PANEL_JOINT_DIMENSIONS_INVALID',
          [joint.id],
          'Joint length, actual participating stock and clearance must be valid.',
        ),
      );
    if (joint.kind === 'crease' && Math.abs(stockA - stockB) > EPS_LENGTH_MM)
      issues.push(
        outputIssue(
          'PANEL_STOCK_JOIN_INVALID',
          [joint.id],
          'A physical crease cannot join different stock thicknesses in one sheet piece.',
        ),
      );
    for (const [panel, edge] of [
      [a, joint.edgeA],
      [b, joint.edgeB],
    ] as const) {
      if (edge === 'face' || joint.kind === 'half-lap') continue;
      let length = edge === 'top' || edge === 'bottom' ? panel.widthMm : panel.heightMm;
      if (
        (panel.role === 'front' || panel.role === 'back') &&
        (edge === 'top' || edge === 'bottom')
      )
        length -= 2 * thicknessForRole(panel.role, settings, material);
      if (Math.abs(length - joint.sharedLengthMm) > EPS_LENGTH_MM)
        issues.push(
          outputIssue(
            'PANEL_JOINT_LENGTH_MISMATCH',
            [joint.id, panel.id],
            'Participating effective boundary length differs from the shared joint span.',
          ),
        );
    }
    if (joint.kind === 'finger' && joint.edgeA !== 'face' && joint.edgeB !== 'face') {
      if (
        !Number.isInteger(joint.fingerCount) ||
        joint.fingerCount < 3 ||
        joint.fingerCount % 2 !== 1
      ) {
        issues.push(
          outputIssue(
            'PANEL_FINGER_PATTERN_INVALID',
            [joint.id],
            'Finger joint requires an odd matched segment count.',
          ),
        );
        continue;
      }
      for (let i = 0; i < joint.fingerCount; i++) {
        const fraction = (i + 0.5) / joint.fingerCount,
          ra = reliefAt(a, joint.edgeA, joint.sharedLengthMm, fraction, stockB * 1.5),
          rb = reliefAt(b, joint.edgeB, joint.sharedLengthMm, fraction, stockA * 1.5);
        if (
          ra === undefined ||
          rb === undefined ||
          (ra > EPS_LENGTH_MM && rb > EPS_LENGTH_MM) ||
          (ra < -EPS_LENGTH_MM && rb < -EPS_LENGTH_MM) ||
          (Math.abs(ra) > EPS_LENGTH_MM && Math.abs(Math.abs(ra) - stockB) > EPS_LENGTH_MM) ||
          (Math.abs(rb) > EPS_LENGTH_MM && Math.abs(Math.abs(rb) - stockA) > EPS_LENGTH_MM)
        ) {
          issues.push(
            outputIssue(
              'PANEL_FINGER_RECIPROCITY_INVALID',
              [joint.id, a.id, b.id],
              'A finger protrusion lacks its complementary stock-aware recess.',
            ),
          );
          break;
        }
      }
    }
  }
  issues.push(...canonicalizeContours(parts).issues);
  return [...new Map(issues.map((i) => [i.id, i])).values()];
}
