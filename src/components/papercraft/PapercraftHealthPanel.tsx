import { seamEditForCommand } from '../../geometry/papercraft/modifySeams';
import { outputIssueMessage } from '../../locales/outputCopy';
import { useProjectStore } from '../../state/useProjectStore';
import { papercraftCopy } from '../../locales/papercraftCopy';
export function PapercraftHealthPanel() {
  const project = useProjectStore((s) => s.project),
    candidate = useProjectStore((s) => s.papercraftCandidate),
    edit = useProjectStore((s) => s.editPapercraftEdge),
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
      <p className="field-help">
        {locale === 'he'
          ? 'תצוגת הקיפול אינה הוכחה לסדר הרכבה ללא התנגשויות.'
          : 'The fold preview does not prove a collision-free assembly sequence.'}
      </p>
      {issues.filter((i) => i.severity !== 'info').length > 30 ? (
        <p>
          {locale === 'he'
            ? 'מוצגות 30 הבעיות הראשונות; כל הבעיות נשמרות בפרויקט.'
            : 'Showing the first 30 issues; all issues remain in the project.'}
        </p>
      ) : null}
      {candidate?.sourceProject === project
        ? candidate.result.tabs
            .filter((t) => t.status === 'unresolved')
            .slice(0, 30)
            .map((tab) => (
              <div key={tab.id}>
                <span dir="ltr">{tab.edgeKey}</span>
                {(['flip', 'hide'] as const).map((command) => (
                  <button
                    type="button"
                    key={command}
                    onClick={() => {
                      const value = seamEditForCommand(
                        project.papercraft!.settings,
                        candidate.result,
                        tab.edgeKey,
                        command,
                      );
                      if (value) edit(value);
                    }}
                  >
                    {locale === 'he'
                      ? command === 'flip'
                        ? 'העבר לשונית לצד השני'
                        : 'בטל לשונית ללא פתרון'
                      : command === 'flip'
                        ? 'Flip unresolved tab'
                        : 'Suppress unresolved tab'}
                  </button>
                ))}
              </div>
            ))
        : null}
      {issues
        .filter((i) => i.severity !== 'info')
        .slice(0, 30)
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
