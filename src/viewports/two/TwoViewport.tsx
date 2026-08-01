import { copy } from '../../locales/en';
import { useProjectStore } from '../../state/useProjectStore';

export function TwoViewport() {
  const sheet = useProjectStore((state) => state.project.sheetLayouts[0]);

  if (!sheet) return null;

  return (
    <section className="viewport-stage two-stage" aria-label={copy.layoutPreview}>
      <svg
        className="sheet-preview"
        viewBox={`0 0 ${sheet.widthMm} ${sheet.heightMm}`}
        role="img"
        aria-label={`${sheet.widthMm} by ${sheet.heightMm} millimetre sheet`}
      >
        <rect
          x="0.5"
          y="0.5"
          width={sheet.widthMm - 1}
          height={sheet.heightMm - 1}
          fill="#fffdf8"
          stroke="#315c52"
        />
        <rect
          x={sheet.marginMm}
          y={sheet.marginMm}
          width={sheet.widthMm - sheet.marginMm * 2}
          height={sheet.heightMm - sheet.marginMm * 2}
          fill="none"
          stroke="#b4aea0"
          strokeDasharray="3 2"
        />
      </svg>
      <div className="empty-state">
        <span className="empty-state-mark" aria-hidden="true">
          ⌁
        </span>
        <h2>{copy.noPartsTitle}</h2>
        <p>{copy.noPartsBody}</p>
      </div>
    </section>
  );
}
