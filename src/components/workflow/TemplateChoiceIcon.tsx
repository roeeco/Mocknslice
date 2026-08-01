import type { TemplateKind } from '../../domain/folding';

const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function SourceChoiceIcon({ kind }: { kind: 'import' | 'template' }) {
  return (
    <svg className="source-choice-icon" viewBox="0 0 64 64" aria-hidden="true">
      <g {...strokeProps}>
        {kind === 'import' ? (
          <>
            <path d="M32 8v29M21 27l11 11 11-11" />
            <path d="M13 42v10h38V42M18 48h28" />
          </>
        ) : (
          <>
            <path d="M24 24h16v16H24zM24 12h16v12H24zM24 40h16v12H24zM12 24h12v16H12zM40 24h12v16H40z" />
            <path d="M24 24h16v16H24z" strokeDasharray="3 3" />
          </>
        )}
      </g>
    </svg>
  );
}

export function TemplateChoiceIcon({ kind }: { kind: TemplateKind }) {
  return (
    <svg className="template-choice-icon" viewBox="0 0 96 72" aria-hidden="true">
      <g {...strokeProps}>
        {kind === 'open-box' ? (
          <>
            <path d="M34 26h28v22H34zM34 12h28v14H34zM34 48h28v14H34zM18 26h16v22H18zM62 26h16v22H62z" />
            <path d="M34 26h28v22H34z" strokeDasharray="4 3" />
          </>
        ) : null}
        {kind === 'box-with-lid' ? (
          <>
            <path d="M16 31h28v21H16zM20 25l10-7 10 7M44 35l10-8 24 8-10 8-24-8Z" />
            <path d="M44 35v17l24 8V43M68 43l10-8v17l-10 8" strokeDasharray="4 3" />
          </>
        ) : null}
        {kind === 'tray' ? (
          <>
            <path d="m18 27 30-14 30 14-30 15Z" />
            <path d="m18 27 5 22 25 12 25-12 5-22M23 49l25-13 25 13" />
          </>
        ) : null}
        {kind === 'sleeve' ? (
          <>
            <path d="M20 24c0-8 9-14 20-14s20 6 20 14v26c0 8-9 14-20 14s-20-6-20-14Z" />
            <path d="M40 10h20l16 12v28L60 64H40" />
            <path d="M60 24h16M60 50h16" strokeDasharray="4 3" />
          </>
        ) : null}
        {kind === 'envelope' ? (
          <>
            <path d="M14 19h68v40H14zM14 19l34 27 34-27M14 59l25-22M82 59 57 37" />
            <path d="M19 14h58" strokeDasharray="4 3" />
          </>
        ) : null}
        {kind === 'regular-prism' ? (
          <>
            <path d="m22 36 13-22h26l13 22-13 22H35Z" />
            <path d="m22 36 18 8 34-8M40 44v20M74 36v20M40 64h34" strokeDasharray="4 3" />
          </>
        ) : null}
        {kind === 'pyramid-frustum' ? (
          <>
            <path d="m32 18 16-8 16 8-16 8Z" />
            <path d="m18 49 30-15 30 15-30 15Z" />
            <path d="M32 18 18 49M64 18l14 31M48 26v8" />
          </>
        ) : null}
      </g>
    </svg>
  );
}
