import type { FabricationMode } from '../../domain/fabrication';
import foldTemplateIcon from '../../assets/mode-icons/fold-template.svg';
import panelConstructionIcon from '../../assets/mode-icons/panel-construction.svg';
import stackedSlicesIcon from '../../assets/mode-icons/stacked-slices.svg';
import waffleSlicesIcon from '../../assets/mode-icons/waffle-slices.svg';

const modeIcons: Record<FabricationMode, string> = {
  'stacked-slices': stackedSlicesIcon,
  'waffle-slices': waffleSlicesIcon,
  'fold-template': foldTemplateIcon,
  'mesh-unfold': foldTemplateIcon,
  'panel-construction': panelConstructionIcon,
};

export type ModeChoice = FabricationMode | 'folding';

export function ModeIcon({ mode }: { mode: ModeChoice }) {
  return (
    <img
      className="mode-icon"
      src={mode === 'folding' ? foldTemplateIcon : modeIcons[mode]}
      alt=""
      aria-hidden="true"
    />
  );
}
