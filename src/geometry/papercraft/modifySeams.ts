import type {
  PapercraftEdgeEdit,
  PapercraftResult,
  PapercraftSettingsV2,
} from '../../domain/papercraft';
export type PapercraftEdgeCommand = 'split' | 'join' | 'auto' | 'flip' | 'hide' | 'show';
export function seamEditForCommand(
  settings: PapercraftSettingsV2,
  result: PapercraftResult,
  key: string,
  command: PapercraftEdgeCommand,
): PapercraftEdgeEdit | undefined {
  const edge = result.source.halfEdges.find((e) => e.edgeKey === key);
  if (!edge) return;
  const previous = settings.edgeEdits.find((e) => e.id === key),
    tab = result.tabs.find((t) => t.edgeKey === key),
    owner = tab?.ownerFaceId === edge.faceId ? ('face-a' as const) : ('face-b' as const);
  const edit: PapercraftEdgeEdit = structuredClone(
    previous ?? {
      id: key,
      intent: 'auto',
      tab: {
        owner: tab ? owner : 'face-a',
        targetDepthMm: settings.tabDefaultDepthMm,
        shoulderAngleDeg: settings.tabShoulderAngleDeg,
      },
    },
  );
  if (command === 'split') edit.intent = 'must-cut';
  if (command === 'join') edit.intent = 'must-join';
  if (command === 'auto') edit.intent = 'auto';
  if (command === 'flip') edit.tab.owner = owner === 'face-a' ? 'face-b' : 'face-a';
  if (command === 'hide') edit.tab.owner = 'none';
  if (command === 'show') edit.tab.owner = owner;
  return edit;
}
