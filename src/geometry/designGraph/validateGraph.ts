import type { DesignPanel, FabricationDesignGraph } from '../../domain/designGraph';
import type { Point2D } from '../../domain/geometry';
import type { ValidationIssue } from '../../domain/validation';
import { isSimplePolygon, pointInPolygon, segmentsIntersect, signedArea } from './polygons';
import { edgeMatchToleranceMm, EPS_AREA_MM2, EPS_LENGTH_MM } from './tolerances';

export function panelLoop(panel: DesignPanel, ids: readonly string[]): Point2D[] {
  const vertices = new Map(panel.vertices.map((v) => [v.id, v]));
  return ids.flatMap((id) =>
    vertices.has(id) ? [{ x: vertices.get(id)!.x, y: vertices.get(id)!.y }] : [],
  );
}

export function graphIssue(code: string, ids: string[], message: string): ValidationIssue {
  return {
    id: `${code}:${ids.join(':')}`,
    code,
    severity: 'error',
    affectedEntityIds: ids,
    message,
    suggestedAction: 'Review the affected geometry and regenerate.',
  };
}

export function validateGraph(graph: FabricationDesignGraph): ValidationIssue[] {
  const issues = [...graph.issues];
  const add = (code: string, ids: string[], message: string) =>
    issues.push(graphIssue(code, ids, message));
  if (graph.schemaVersion !== 1 || graph.units !== 'mm')
    add('GRAPH_SCHEMA_INVALID', [], 'Unsupported design graph schema or units.');
  const entities = [
    ...graph.panels,
    ...graph.connections,
    ...graph.features,
    ...graph.pieces,
    ...graph.panels.flatMap((p) => p.vertices),
  ];
  const ids = new Set<string>();
  for (const entity of entities) {
    if (!entity.id.trim() || ids.has(entity.id))
      add('GRAPH_ID_INVALID', [entity.id], 'Graph IDs must be nonempty and globally unique.');
    ids.add(entity.id);
  }
  const panels = new Map(graph.panels.map((p) => [p.id, p]));
  const pieces = new Map(graph.pieces.map((p) => [p.id, p]));
  for (const panel of graph.panels) {
    if (!pieces.has(panel.pieceId))
      add(
        'GRAPH_REFERENCE_MISSING',
        [panel.id, panel.pieceId],
        'Panel references an unknown piece.',
      );
    if (!Number.isFinite(panel.materialThicknessMm) || panel.materialThicknessMm <= 0)
      add('GRAPH_STOCK_INVALID', [panel.id], 'Panel stock must be positive and finite.');
    if (panel.vertices.some((v) => !Number.isFinite(v.x) || !Number.isFinite(v.y)))
      add('GRAPH_COORDINATE_INVALID', [panel.id], 'All graph coordinates must be finite.');
    const vertexIds = new Set(panel.vertices.map((v) => v.id));
    for (const loop of [panel.boundary, ...panel.holes])
      if (loop.some((id) => !vertexIds.has(id)))
        add('GRAPH_REFERENCE_MISSING', [panel.id], 'Panel loop references an unknown vertex.');
    const outer = panelLoop(panel, panel.boundary);
    if (!isSimplePolygon(outer) || signedArea(outer) <= EPS_AREA_MM2)
      add(
        'GRAPH_CONTOUR_INVALID',
        [panel.id],
        'Outer boundary must be a simple counter-clockwise polygon.',
      );
    const holes = panel.holes.map((loop) => panelLoop(panel, loop));
    for (const [index, hole] of holes.entries()) {
      if (
        !isSimplePolygon(hole) ||
        signedArea(hole) >= -EPS_AREA_MM2 ||
        !hole.every((point) => pointInPolygon(point, outer, false))
      )
        add(
          'GRAPH_HOLE_INVALID',
          [panel.id, String(index)],
          'Holes must be simple clockwise polygons contained inside their panel.',
        );
      if (
        hole.some((a, i) =>
          outer.some((c, j) =>
            segmentsIntersect(a, hole[(i + 1) % hole.length]!, c, outer[(j + 1) % outer.length]!),
          ),
        )
      )
        add(
          'GRAPH_HOLE_INVALID',
          [panel.id, String(index)],
          'A hole intersects the panel boundary.',
        );
      for (let j = 0; j < index; j++) {
        const other = holes[j]!;
        if (
          hole.some((p) => pointInPolygon(p, other)) ||
          other.some((p) => pointInPolygon(p, hole)) ||
          hole.some((a, i) =>
            other.some((c, k) =>
              segmentsIntersect(a, hole[(i + 1) % hole.length]!, c, other[(k + 1) % other.length]!),
            ),
          )
        )
          add(
            'GRAPH_HOLE_INVALID',
            [panel.id, String(index), String(j)],
            'Panel holes overlap or touch.',
          );
      }
    }
    if (panel.assembledPose) {
      const m = panel.assembledPose;
      const columns = [m.slice(0, 3), m.slice(4, 7), m.slice(8, 11)];
      const rigid =
        m.length === 16 &&
        m.every(Number.isFinite) &&
        Math.abs(m[3]!) <= EPS_LENGTH_MM &&
        Math.abs(m[7]!) <= EPS_LENGTH_MM &&
        Math.abs(m[11]!) <= EPS_LENGTH_MM &&
        Math.abs(m[15]! - 1) <= EPS_LENGTH_MM &&
        columns.every((c) => Math.abs(Math.hypot(...c) - 1) <= EPS_LENGTH_MM) &&
        columns.every((c, i) =>
          columns
            .slice(i + 1)
            .every(
              (other) => Math.abs(c.reduce((s, v, k) => s + v * other[k]!, 0)) <= EPS_LENGTH_MM,
            ),
        );
      if (!rigid)
        add('GRAPH_POSE_INVALID', [panel.id], 'Assembled pose must be a finite rigid matrix.');
    }
  }
  const parent = new Map(graph.panels.map((p) => [p.id, p.id]));
  const root = (id: string): string => {
    let cursor = id;
    while (parent.get(cursor) !== cursor) cursor = parent.get(cursor)!;
    return cursor;
  };
  for (const connection of graph.connections) {
    const a = panels.get(connection.panelAId),
      b = connection.panelBId ? panels.get(connection.panelBId) : undefined;
    if (!a || (connection.panelBId && !b)) {
      add('GRAPH_REFERENCE_MISSING', [connection.id], 'Connection references an unknown panel.');
      continue;
    }
    const av = new Map(a.vertices.map((v) => [v.id, v]));
    const pa = av.get(connection.edgeA.a),
      qa = av.get(connection.edgeA.b);
    const bv = new Map(b?.vertices.map((v) => [v.id, v]) ?? []);
    const pb = connection.edgeB ? bv.get(connection.edgeB.a) : undefined,
      qb = connection.edgeB ? bv.get(connection.edgeB.b) : undefined;
    if (!pa || !qa || (b && (!pb || !qb))) {
      add(
        'GRAPH_REFERENCE_MISSING',
        [connection.id],
        'Connection edge references an unknown vertex.',
      );
      continue;
    }
    const length = Math.hypot(pa.x - qa.x, pa.y - qa.y);
    if (
      length <= EPS_LENGTH_MM ||
      !Number.isFinite(length) ||
      (pb &&
        qb &&
        Math.abs(length - Math.hypot(pb.x - qb.x, pb.y - qb.y)) > edgeMatchToleranceMm(length))
    )
      add(
        'GRAPH_EDGE_LENGTH_INVALID',
        [connection.id],
        'Connection partner edges must have equal nonzero physical length.',
      );
    if (connection.foldAngleDeg !== undefined && !Number.isFinite(connection.foldAngleDeg))
      add('GRAPH_ANGLE_INVALID', [connection.id], 'Fold angle must be finite.');
    if (
      connection.tabOwnerPanelId &&
      connection.tabOwnerPanelId !== a.id &&
      connection.tabOwnerPanelId !== b?.id
    )
      add(
        'GRAPH_TAB_OWNER_INVALID',
        [connection.id],
        'Tab owner must be one of the connection panels.',
      );
    if (connection.closure === 'glue-tab' && !connection.tabOwnerPanelId)
      add('GRAPH_TAB_OWNER_INVALID', [connection.id], 'Glue closure needs an explicit tab owner.');
    if (connection.flatJoined && b) {
      if (
        connection.treatment !== 'hinge' ||
        a.pieceId !== b.pieceId ||
        !pb ||
        !qb ||
        Math.hypot(pa.x - qb.x, pa.y - qb.y) > EPS_LENGTH_MM ||
        Math.hypot(qa.x - pb.x, qa.y - pb.y) > EPS_LENGTH_MM
      )
        add(
          'GRAPH_ADJACENCY_INVALID',
          [connection.id],
          'Joined flat edges must coincide with reversed orientation in the same piece.',
        );
      const ra = root(a.id),
        rb = root(b.id);
      if (ra === rb)
        add('GRAPH_HINGE_CYCLE', [connection.id], 'Flat hinge connections must form a forest.');
      else parent.set(rb, ra);
    }
  }
  const featureIds = new Map(graph.features.map((f) => [f.id, f]));
  const segments = new Map<string, string>();
  const pointKey = (p: Point2D) =>
    `${Math.round(p.x / EPS_LENGTH_MM)},${Math.round(p.y / EPS_LENGTH_MM)}`;
  for (const feature of graph.features) {
    if (
      feature.hostPanelId &&
      panels.has(feature.hostPanelId) &&
      panels.get(feature.hostPanelId)!.pieceId !== feature.pieceId
    )
      add(
        'GRAPH_REFERENCE_MISSING',
        [feature.id],
        'Feature and host panel belong to different pieces.',
      );
    if (
      (feature.path &&
        (feature.path.id !== feature.id || feature.path.operation !== feature.operation)) ||
      (feature.label &&
        (feature.label.id !== feature.id || feature.label.operation !== feature.operation))
    )
      add(
        'GRAPH_FEATURE_INVALID',
        [feature.id],
        'Feature identity and operation must match its manufacturing metadata.',
      );
    if (!pieces.has(feature.pieceId) || (feature.hostPanelId && !panels.has(feature.hostPanelId)))
      add('GRAPH_REFERENCE_MISSING', [feature.id], 'Feature references an unknown piece or panel.');
    if (feature.geometry2D.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)))
      add('GRAPH_COORDINATE_INVALID', [feature.id], 'Feature coordinates must be finite.');
    if (feature.path && feature.geometry2D.length < 2)
      add('GRAPH_CONTOUR_INVALID', [feature.id], 'A path needs at least two points.');
    if (feature.label && feature.geometry2D.length !== 1)
      add('GRAPH_LABEL_INVALID', [feature.id], 'A label needs exactly one anchor.');
    if (feature.path?.closed && !isSimplePolygon(feature.geometry2D))
      add('GRAPH_CONTOUR_INVALID', [feature.id], 'Closed paths must be simple and nondegenerate.');
    if (feature.operation === 'cut' && feature.path) {
      const points = feature.geometry2D;
      for (let i = 0; i < points.length - (feature.path.closed ? 0 : 1); i++) {
        const a = pointKey(points[i]!),
          b = pointKey(points[(i + 1) % points.length]!);
        if (a === b) continue; // Repeated explicit closure in a legacy path has no physical segment.
        const key = `${feature.pieceId}:${[a, b].sort().join('|')}`;
        const previous = segments.get(key);
        if (previous)
          add(
            'GRAPH_DUPLICATE_CUT',
            [previous, feature.id],
            'The same physical cut segment occurs twice.',
          );
        segments.set(key, feature.id);
      }
    }
  }
  for (const piece of graph.pieces) {
    if (
      new Set([...piece.pathIds, ...piece.labelIds]).size !==
      piece.pathIds.length + piece.labelIds.length
    )
      add(
        'GRAPH_ID_INVALID',
        [piece.id],
        'A piece cannot reference a manufacturing feature twice.',
      );
    if (
      piece.id !== piece.metadata.id ||
      !Number.isFinite(piece.metadata.thicknessMm) ||
      piece.metadata.thicknessMm <= 0
    )
      add('GRAPH_STOCK_INVALID', [piece.id], 'Piece metadata and physical stock must be valid.');
    for (const id of [...piece.pathIds, ...piece.labelIds])
      if (featureIds.get(id)?.pieceId !== piece.id)
        add(
          'GRAPH_REFERENCE_MISSING',
          [piece.id, id],
          'Piece references an unknown or differently owned feature.',
        );
  }
  return issues;
}
