import { copy } from '../../../locales';

export function PanelFeatureToolbar({
  onAdd,
}: {
  onAdd: (kind: 'rectangular-cutout' | 'circular-cutout' | 'engraved-label') => void;
}) {
  return (
    <div
      className="panel-feature-toolbar"
      role="toolbar"
      aria-label={copy.panelComposer.addFeature}
    >
      <button type="button" onClick={() => onAdd('rectangular-cutout')}>
        <span aria-hidden="true">▭</span> {copy.panelComposer.addRectangle}
      </button>
      <button type="button" onClick={() => onAdd('circular-cutout')}>
        <span aria-hidden="true">○</span> {copy.panelComposer.addCircle}
      </button>
      <button type="button" onClick={() => onAdd('engraved-label')}>
        <span aria-hidden="true">T</span> {copy.panelComposer.addLabel}
      </button>
    </div>
  );
}
