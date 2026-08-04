import type {
  AssembledFoldPanel,
  FoldConnection,
  FoldPanel,
  FoldSegment,
} from '../../domain/folding';
import type { Vector3Mm } from '../../domain/geometry';

export interface ConnectionAlignment {
  connectionId: string;
  maximumEndpointErrorMm: number;
  aligned: boolean;
}

export interface AssemblyAlignmentReport {
  connections: ConnectionAlignment[];
  maximumEndpointErrorMm: number;
  unmeasurableConnectionIds: string[];
}

function distance3D(a: Vector3Mm, b: Vector3Mm): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function candidateEdges(
  segment: FoldSegment,
  panel: AssembledFoldPanel,
  toleranceMm: number,
): [Vector3Mm, Vector3Mm][] {
  const targetLength = Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y);
  const result: [Vector3Mm, Vector3Mm][] = [];
  for (let index = 0; index < panel.verticesMm.length; index += 1) {
    const next = (index + 1) % panel.verticesMm.length;
    const start = panel.verticesMm[index]!;
    const end = panel.verticesMm[next]!;
    if (Math.abs(distance3D(start, end) - targetLength) <= toleranceMm) result.push([start, end]);
  }
  return result;
}

function bestAlignment(edgesA: [Vector3Mm, Vector3Mm][], edgesB: [Vector3Mm, Vector3Mm][]): number {
  return Math.min(
    ...edgesA.flatMap((edgeA) =>
      edgesB.map((edgeB) => {
        const direct = Math.max(distance3D(edgeA[0], edgeB[0]), distance3D(edgeA[1], edgeB[1]));
        const reversed = Math.max(distance3D(edgeA[0], edgeB[1]), distance3D(edgeA[1], edgeB[0]));
        return Math.min(direct, reversed);
      }),
    ),
  );
}

export function measureConnectionAlignment(
  panels: readonly FoldPanel[],
  assembledPanels: readonly AssembledFoldPanel[],
  connections: readonly FoldConnection[],
  toleranceMm = 0.1,
): AssemblyAlignmentReport {
  const flatById = new Map(panels.map((panel) => [panel.id, panel]));
  const assembledById = new Map(assembledPanels.map((panel) => [panel.id, panel]));
  const measured: ConnectionAlignment[] = [];
  const unmeasurableConnectionIds: string[] = [];
  for (const connection of connections) {
    const flatA = flatById.get(connection.panelAId);
    const flatB = flatById.get(connection.panelBId);
    const assembledA = assembledById.get(connection.panelAId);
    const assembledB = assembledById.get(connection.panelBId);
    if (!flatA || !flatB || !assembledA || !assembledB) {
      unmeasurableConnectionIds.push(connection.id);
      continue;
    }
    const edgesA = candidateEdges(connection.edgeA, assembledA, toleranceMm);
    const edgesB = candidateEdges(connection.edgeB, assembledB, toleranceMm);
    if (edgesA.length === 0 || edgesB.length === 0) {
      unmeasurableConnectionIds.push(connection.id);
      continue;
    }
    const maximumEndpointErrorMm = bestAlignment(edgesA, edgesB);
    measured.push({
      connectionId: connection.id,
      maximumEndpointErrorMm,
      aligned: maximumEndpointErrorMm <= toleranceMm,
    });
  }
  return {
    connections: measured,
    maximumEndpointErrorMm: Math.max(
      ...measured.map((connection) => connection.maximumEndpointErrorMm),
      0,
    ),
    unmeasurableConnectionIds,
  };
}
