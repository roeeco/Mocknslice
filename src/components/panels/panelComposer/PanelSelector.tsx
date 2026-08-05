import type { PanelFeatureTargetRole } from '../../../domain/modeSettings';
import { copy } from '../../../locales';

const PANEL_ROLES: readonly PanelFeatureTargetRole[] = [
  'base',
  'front',
  'back',
  'left',
  'right',
  'lid',
];

export function PanelSelector({
  selected,
  includeLid,
  onSelect,
}: {
  selected: PanelFeatureTargetRole;
  includeLid: boolean;
  onSelect: (role: PanelFeatureTargetRole) => void;
}) {
  return (
    <div className="panel-selector" role="group" aria-label={copy.panelComposer.panelChoice}>
      {PANEL_ROLES.filter((role) => role !== 'lid' || includeLid).map((role) => (
        <button
          key={role}
          type="button"
          aria-pressed={role === selected}
          onClick={() => onSelect(role)}
        >
          {copy.panelComposer.panelNames[role]}
        </button>
      ))}
    </div>
  );
}
