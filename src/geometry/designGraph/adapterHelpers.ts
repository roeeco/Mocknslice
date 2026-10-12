import type { DesignPanel } from '../../domain/designGraph';
import type { Point2D, Vector3Mm } from '../../domain/geometry';
import { recoverPanelPose, type PoseConstraint } from './poses';

export function makeLegacyPanel(
  input: { id: string; partId: string; name: string; outline: Point2D[] },
  thicknessMm: number,
  assembled?: readonly Vector3Mm[],
  holes: Point2D[][] = [],
  constraints: PoseConstraint[] = [],
): DesignPanel {
  const closed =
    input.outline.length > 3 &&
    Math.hypot(
      input.outline[0]!.x - input.outline.at(-1)!.x,
      input.outline[0]!.y - input.outline.at(-1)!.y,
    ) < 1e-6;
  const outline = closed ? input.outline.slice(0, -1) : input.outline;
  const world = assembled && closed ? assembled.slice(0, -1) : assembled;
  const names =
    outline.length === 4
      ? ['corner-sw', 'corner-se', 'corner-ne', 'corner-nw']
      : outline.map((_, i) => `boundary-${i + 1}`);
  const vertices = outline.map((point, i) => ({
    id: `${input.id}:${names[i]}`,
    x: point.x,
    y: point.y,
  }));
  const holeIds = holes.map((loop, h) =>
    loop.map((point, i) => {
      const id = `${input.id}:hole-${h + 1}:vertex-${i + 1}`;
      vertices.push({ id, x: point.x, y: point.y });
      return id;
    }),
  );
  const recovered = world ? recoverPanelPose(outline, world, constraints) : undefined;
  const assemblyBoundary = recovered
    ? world!.map((_, i) => vertices[recovered.order.indexOf(i)]!.id)
    : undefined;
  if (closed && assemblyBoundary) assemblyBoundary.push(assemblyBoundary[0]!);
  return {
    id: input.id,
    pieceId: input.partId,
    name: input.name,
    vertices,
    boundary: vertices.slice(0, outline.length).map((v) => v.id),
    holes: holeIds,
    materialThicknessMm: thicknessMm,
    ...(recovered && assemblyBoundary ? { assembledPose: recovered.pose, assemblyBoundary } : {}),
  };
}

export function registerEdge(
  panel: DesignPanel,
  connectionId: string,
  start: Point2D,
  end: Point2D,
): { a: string; b: string } {
  const a = `${panel.id}:${connectionId}:start`,
    b = `${panel.id}:${connectionId}:end`;
  panel.vertices.push({ id: a, x: start.x, y: start.y }, { id: b, x: end.x, y: end.y });
  return { a, b };
}
