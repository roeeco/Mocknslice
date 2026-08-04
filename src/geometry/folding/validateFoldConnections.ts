import type { FoldConnection, FoldPanel, FoldTab } from '../../domain/folding';
import type { Point2D } from '../../domain/geometry';
import type { ValidationIssue } from '../../domain/validation';

const TOLERANCE_MM = 0.001;

function pointOnSegment(point: Point2D, start: Point2D, end: Point2D): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const cross = Math.abs(dx * (point.y - start.y) - dy * (point.x - start.x));
  const dot = (point.x - start.x) * dx + (point.y - start.y) * dy;
  const lengthSquared = dx * dx + dy * dy;
  return (
    cross <= Math.sqrt(lengthSquared) * TOLERANCE_MM &&
    dot >= -TOLERANCE_MM &&
    dot <= lengthSquared + TOLERANCE_MM
  );
}

function onBoundary(segment: { start: Point2D; end: Point2D }, panel: FoldPanel): boolean {
  return panel.outline.some((start, index) => {
    const end = panel.outline[(index + 1) % panel.outline.length]!;
    return pointOnSegment(segment.start, start, end) && pointOnSegment(segment.end, start, end);
  });
}

function length(segment: { start: Point2D; end: Point2D }): number {
  return Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y);
}

export function validateFoldConnections(
  panels: readonly FoldPanel[],
  connections: readonly FoldConnection[],
  tabs: readonly FoldTab[],
): ValidationIssue[] {
  const byId = new Map(panels.map((panel) => [panel.id, panel]));
  const issues: ValidationIssue[] = [];
  for (const connection of connections) {
    const a = byId.get(connection.panelAId);
    const b = byId.get(connection.panelBId);
    if (!a || !b) {
      issues.push({
        id: `${connection.id}-panel-missing`,
        severity: 'error',
        code: 'FOLD_CONNECTION_PANEL_MISSING',
        message: `Connection ${connection.id} references a missing panel.`,
        affectedEntityIds: [connection.id, connection.panelAId, connection.panelBId],
      });
      continue;
    }
    if (!onBoundary(connection.edgeA, a) || !onBoundary(connection.edgeB, b)) {
      issues.push({
        id: `${connection.id}-boundary-invalid`,
        severity: 'error',
        code: 'FOLD_CONNECTION_BOUNDARY_INVALID',
        message: `Connection ${connection.id} does not lie on both panel boundaries.`,
        affectedEntityIds: [connection.id, a.id, b.id],
      });
    }
    if (Math.abs(length(connection.edgeA) - length(connection.edgeB)) > TOLERANCE_MM) {
      issues.push({
        id: `${connection.id}-length-mismatch`,
        severity: 'error',
        code: 'FOLD_CONNECTION_LENGTH_MISMATCH',
        message: `Connection ${connection.id} has mismatched seam lengths.`,
        affectedEntityIds: [connection.id, a.id, b.id],
      });
    }
    const enabledTabs = tabs.filter((tab) => connection.tabIds.includes(tab.id) && tab.enabled);
    if (connection.required && (connection.closure === 'none' || enabledTabs.length !== 1)) {
      issues.push({
        id: `${connection.id}-closure-invalid`,
        severity: 'error',
        code: 'FOLD_CONNECTION_CLOSURE_INVALID',
        message: `Required seam ${connection.id} must have exactly one enabled closure.`,
        affectedEntityIds: [connection.id, ...connection.tabIds],
      });
    }
  }
  return issues;
}
