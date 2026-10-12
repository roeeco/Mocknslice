import { useProjectStore } from '../../state/useProjectStore';
import type { SheetPlacement } from '../../domain/fabrication';
import { transformPoint } from '../../geometry/layout/partPlacement';
import { flatEdge } from '../../geometry/papercraft/edgeGeometry';
import { useIsDraftPreview } from '../../viewports/PreviewProject';
/** Accessible SVG targets use the same stable source edge keys as the 3D targets. */
export function PapercraftNetCanvas({
  partId,
  placement,
}: {
  partId: string;
  placement: SheetPlacement;
}) {
  const result = useProjectStore((s) => s.project.papercraft?.result),
    select = useProjectStore((s) => s.selectEntity),
    selected = useProjectStore((s) => s.selectedEntityId),
    mode = useProjectStore((s) => s.project.fabricationMode),
    draft = useIsDraftPreview();
  if (!result || mode !== 'mesh-unfold' || draft) return null;
  const island = result.islands.find((i) => i.id === partId);
  if (!island) return null;
  const targets = result.source.halfEdges.filter(
    (e) =>
      island.faceIds.includes(e.faceId) &&
      (!result.hingeKeys.includes(e.edgeKey) || e.id < e.oppositeId!),
  );
  return (
    <g className="papercraft-net-targets">
      {result.faces
        .filter((face) => island.faceIds.includes(face.id))
        .map((face) => (
          <polygon
            key={face.id}
            data-papercraft-face={face.id}
            points={face.points
              .map((p) => {
                const t = transformPoint(p, placement);
                return `${t.x},${t.y}`;
              })
              .join(' ')}
            fill={selected === face.id ? '#f7b32b55' : '#3f7f7008'}
            stroke="none"
            onClick={(event) => {
              event.stopPropagation();
              select(face.id, partId);
            }}
          />
        ))}
      {targets.map((edge) => {
        const face = result.faces.find((f) => f.id === edge.faceId)!,
          [a, b] = flatEdge(face, edge),
          start = transformPoint(a, placement),
          end = transformPoint(b, placement),
          active = selected === `edge-${edge.edgeKey}`;
        const choose = () => select(`edge-${edge.edgeKey}`, partId);
        return (
          <g
            key={edge.id}
            role="button"
            tabIndex={0}
            aria-label={`Edge ${edge.edgeKey} on ${edge.faceId}`}
            aria-pressed={active}
            data-papercraft-edge={edge.edgeKey}
            data-face-id={edge.faceId}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              choose();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                choose();
              }
            }}
          >
            <path
              d={`M ${start.x} ${start.y} L ${end.x} ${end.y}`}
              fill="none"
              stroke={active ? '#f7b32b' : 'transparent'}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={(start.x + end.x) / 2}
              cy={(start.y + end.y) / 2}
              r="1.5"
              fill={active ? '#f7b32b' : 'transparent'}
            />
          </g>
        );
      })}
    </g>
  );
}
