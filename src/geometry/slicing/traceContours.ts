import type { Point2D } from '../../domain/geometry';
import type { SliceContour, SliceSegment } from './types';

interface Node {
  point: Point2D;
  edges: number[];
}

export interface TraceContoursResult {
  contours: SliceContour[];
  openContourCount: number;
  ambiguousNodeCount: number;
}

function cell(value: number, epsilon: number): number {
  return Math.floor(value / epsilon);
}

export function traceContours(segments: SliceSegment[], epsilonMm: number): TraceContoursResult {
  if (!Number.isFinite(epsilonMm) || epsilonMm <= 0) {
    throw new Error('Contour tolerance must be greater than zero.');
  }
  const nodes: Node[] = [];
  const buckets = new Map<string, number[]>();
  const findOrCreateNode = (point: Point2D): number => {
    const cellX = cell(point.x, epsilonMm);
    const cellY = cell(point.y, epsilonMm);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const candidates = buckets.get(`${cellX + dx},${cellY + dy}`) ?? [];
        for (const candidate of candidates) {
          const existing = nodes[candidate]?.point;
          if (
            existing &&
            (existing.x - point.x) ** 2 + (existing.y - point.y) ** 2 <= epsilonMm ** 2
          ) {
            return candidate;
          }
        }
      }
    }
    const index = nodes.length;
    nodes.push({ point: { ...point }, edges: [] });
    const key = `${cellX},${cellY}`;
    buckets.set(key, [...(buckets.get(key) ?? []), index]);
    return index;
  };

  const edges: [number, number][] = [];
  const edgeKeys = new Set<string>();
  for (const segment of segments) {
    const start = findOrCreateNode(segment.start);
    const end = findOrCreateNode(segment.end);
    if (start === end) continue;
    const key = start < end ? `${start}:${end}` : `${end}:${start}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    const edgeIndex = edges.length;
    edges.push([start, end]);
    nodes[start]?.edges.push(edgeIndex);
    nodes[end]?.edges.push(edgeIndex);
  }

  const visited = new Set<number>();
  const contours: SliceContour[] = [];
  const starts = nodes
    .map((node, index) => ({ index, degree: node.edges.length }))
    .filter(({ degree }) => degree !== 0)
    .sort((a, b) => Number(a.degree === 1) - Number(b.degree === 1));

  const traceFrom = (startNode: number, firstEdge: number) => {
    const nodeIndices = [startNode];
    let currentNode = startNode;
    let edgeIndex: number | undefined = firstEdge;
    while (edgeIndex !== undefined && !visited.has(edgeIndex)) {
      visited.add(edgeIndex);
      const edge = edges[edgeIndex];
      if (!edge) break;
      const nextNode = edge[0] === currentNode ? edge[1] : edge[0];
      nodeIndices.push(nextNode);
      currentNode = nextNode;
      if (currentNode === startNode) break;
      edgeIndex = nodes[currentNode]?.edges.find((candidate) => !visited.has(candidate));
    }
    const closed = nodeIndices.length > 2 && nodeIndices.at(-1) === startNode;
    if (closed) nodeIndices.pop();
    contours.push({
      points: nodeIndices.map((index) => ({ ...nodes[index]!.point })),
      closed,
    });
  };

  for (const { index } of starts.filter(({ degree }) => degree === 1)) {
    const firstEdge = nodes[index]?.edges.find((candidate) => !visited.has(candidate));
    if (firstEdge !== undefined) traceFrom(index, firstEdge);
  }
  for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 1) {
    if (!visited.has(edgeIndex)) traceFrom(edges[edgeIndex]![0], edgeIndex);
  }

  return {
    contours: contours.filter((contour) => contour.points.length >= 2),
    openContourCount: contours.filter((contour) => !contour.closed).length,
    ambiguousNodeCount: nodes.filter((node) => node.edges.length > 2).length,
  };
}
