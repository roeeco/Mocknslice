import { copy, t } from '../../locales';
import { useProjectStore } from '../../state/useProjectStore';

export function WarningPanel() {
  const issues = useProjectStore((state) => state.validationIssues);

  return (
    <section className="panel-section warning-section" aria-labelledby="warnings-heading">
      <h2 id="warnings-heading">{copy.warningsPanel}</h2>
      {issues.length === 0 ? (
        <p className="field-help">{t('No current fabrication issues.')}</p>
      ) : null}
      <ul className="issue-list">
        {issues.map((issue) => (
          <li className={`issue issue-${issue.severity}`} key={issue.id}>
            <div className="issue-header">
              <span className="severity-label">{issue.severity}</span>
              <code>{issue.code}</code>
            </div>
            <p>{issue.message}</p>
            {issue.suggestedAction ? <small>{issue.suggestedAction}</small> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
