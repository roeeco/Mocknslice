import type { FoldConnection, FoldTab } from './folding';
import { deriveGenerationState, type GenerationState } from './generation';
import type { ProjectData } from './project';

export interface AssemblyStep {
  id: string;
  kind: 'hinge' | 'seam' | 'joint';
  panelIds: [string, string];
  resolved: boolean;
  dependsOnIds: string[];
}

export interface AssemblyInspection {
  requiredJoinCount: number;
  resolvedJoinCount: number;
  missingJoinCount: number;
  hingeCount: number;
  seamCount: number;
  glueTabCount: number;
  tabCollisionCount: number;
  accessibilityWarningCount: number;
  generationState: GenerationState;
  order: AssemblyStep[];
}

function hingeDependencies(connections: readonly FoldConnection[]): Map<string, string[]> {
  const hinges = connections.filter((connection) => connection.disposition === 'hinge');
  const adjacency = new Map<string, { panelId: string; connectionId: string }[]>();
  for (const hinge of hinges) {
    adjacency.set(hinge.panelAId, [
      ...(adjacency.get(hinge.panelAId) ?? []),
      { panelId: hinge.panelBId, connectionId: hinge.id },
    ]);
    adjacency.set(hinge.panelBId, [
      ...(adjacency.get(hinge.panelBId) ?? []),
      { panelId: hinge.panelAId, connectionId: hinge.id },
    ]);
  }
  const result = new Map<string, string[]>();
  for (const seam of connections.filter((connection) => connection.disposition === 'seam')) {
    const queue = [{ panelId: seam.panelAId, path: [] as string[] }];
    const visited = new Set([seam.panelAId]);
    while (queue.length) {
      const current = queue.shift()!;
      if (current.panelId === seam.panelBId) {
        result.set(seam.id, current.path);
        break;
      }
      for (const next of [...(adjacency.get(current.panelId) ?? [])].sort((a, b) =>
        a.connectionId.localeCompare(b.connectionId),
      )) {
        if (visited.has(next.panelId)) continue;
        visited.add(next.panelId);
        queue.push({ panelId: next.panelId, path: [...current.path, next.connectionId] });
      }
    }
  }
  return result;
}

function connectionResolved(connection: FoldConnection, tabs: readonly FoldTab[]): boolean {
  if (connection.disposition === 'hinge') return true;
  const enabledTabs = tabs.filter((tab) => connection.tabIds.includes(tab.id) && tab.enabled);
  return !connection.required || (connection.closure !== 'none' && enabledTabs.length === 1);
}

export function deriveAssemblyInspection(project: ProjectData): AssemblyInspection {
  const result = project.foldingResult ?? project.unfoldingResult;
  const connections = result?.connections ?? [];
  const tabs = result?.tabs ?? [];
  const dependencies = hingeDependencies(connections);
  const connectionSteps: AssemblyStep[] = [...connections]
    .sort((a, b) => {
      const dispositionOrder = Number(a.disposition === 'seam') - Number(b.disposition === 'seam');
      return dispositionOrder || a.id.localeCompare(b.id);
    })
    .map((connection) => ({
      id: connection.id,
      kind: connection.disposition,
      panelIds: [connection.panelAId, connection.panelBId],
      resolved: connectionResolved(connection, tabs),
      dependsOnIds: dependencies.get(connection.id) ?? [],
    }));
  const constructionSteps: AssemblyStep[] = [...(project.panelConstructionResult?.joints ?? [])]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((joint) => ({
      id: joint.id,
      kind: 'joint',
      panelIds: [joint.panelAId, joint.panelBId],
      resolved: true,
      dependsOnIds: [],
    }));
  const order = [...connectionSteps, ...constructionSteps];
  const requiredSteps = order.filter(
    (step) =>
      step.kind !== 'seam' || connections.find((connection) => connection.id === step.id)?.required,
  );
  const tabCollisionCount = (project.generationIssues ?? []).filter(
    (issue) =>
      issue.code.includes('TAB') &&
      (issue.code.includes('COLLISION') || issue.code.includes('OVERLAP')),
  ).length;
  const accessibilityWarningCount = (project.generationIssues ?? []).filter((issue) =>
    issue.code.includes('ASSEMBLY_ACCESS'),
  ).length;
  return {
    requiredJoinCount: requiredSteps.length,
    resolvedJoinCount: requiredSteps.filter((step) => step.resolved).length,
    missingJoinCount: requiredSteps.filter((step) => !step.resolved).length,
    hingeCount: connections.filter((connection) => connection.disposition === 'hinge').length,
    seamCount: connections.filter((connection) => connection.disposition === 'seam').length,
    glueTabCount: tabs.filter((tab) => tab.enabled && tab.style === 'glue').length,
    tabCollisionCount,
    accessibilityWarningCount,
    generationState: deriveGenerationState(project),
    order,
  };
}

export function assemblySelectionPanelIds(
  project: ProjectData,
  selectedEntityId: string | undefined,
): Set<string> {
  if (!selectedEntityId) return new Set();
  const result = project.foldingResult ?? project.unfoldingResult;
  const tab = result?.tabs.find((candidate) => candidate.id === selectedEntityId);
  if (tab) return new Set([tab.ownerPanelId, tab.receiverPanelId].filter(Boolean) as string[]);
  const connection = result?.connections.find((candidate) => candidate.id === selectedEntityId);
  if (connection) return new Set([connection.panelAId, connection.panelBId]);
  return new Set([selectedEntityId]);
}
