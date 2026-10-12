import { outputIssueMessage } from '../../locales/outputCopy';
import { useProjectStore } from '../../state/useProjectStore';
import { papercraftCopy } from '../../locales/papercraftCopy';
export function PapercraftHealthPanel() {
  const project = useProjectStore((s) => s.project),
    issues = useProjectStore((s) => s.papercraftIssues),
    locale = useProjectStore((s) => s.locale),
    c = papercraftCopy(locale),
    metrics = project.papercraft?.result?.source.metrics;
  return (
    <section>
      <h3>{c.health}</h3>
      <p>
        {c.faces}:{' '}
        <span dir="ltr">
          {metrics
            ? `${metrics.beforeFaceCount} → ${metrics.afterFaceCount}`
            : (project.model.mesh?.indices.length ?? 0) / 3}
        </span>
      </p>
      {metrics ? (
        <p>
          {c.deviation}: <span dir="ltr">{metrics.maximumDeviationMm} mm</span>
        </p>
      ) : null}
      <p className="field-help">{c.triangleFallback}</p>
      {issues
        .filter((i) => i.severity !== 'info')
        .map((issue) => (
          <p role={issue.severity === 'error' ? 'alert' : 'status'} key={issue.id}>
            {outputIssueMessage(issue, locale)}
            <br />
            <span dir="ltr">{issue.affectedEntityIds.join(', ')}</span>
          </p>
        ))}
    </section>
  );
}
