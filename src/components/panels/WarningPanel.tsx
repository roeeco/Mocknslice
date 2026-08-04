import { copy, t } from '../../locales';
import { useProjectStore } from '../../state/useProjectStore';
import type { ValidationIssue } from '../../domain/validation';
import {
  validationIssueMessage,
  validationSeverityLabel,
  validationSuggestedAction,
} from '../../locales/validationMessages';

export function IssueList({ issues }: { issues: ValidationIssue[] }) {
  const locale = useProjectStore((state) => state.locale);
  return (
    <ul className="issue-list">
      {issues.map((issue) => {
        const action = validationSuggestedAction(issue, locale);
        return (
          <li className={`issue issue-${issue.severity}`} key={issue.id}>
            <div className="issue-header">
              <span className="severity-label">
                {validationSeverityLabel(issue.severity, locale)}
              </span>
              <code>{issue.code}</code>
            </div>
            <p>{validationIssueMessage(issue, locale)}</p>
            {action ? <small>{action}</small> : null}
          </li>
        );
      })}
    </ul>
  );
}

export function WarningPanel() {
  const issues = useProjectStore((state) => state.validationIssues);

  return (
    <section className="panel-section warning-section" aria-labelledby="warnings-heading">
      <h2 id="warnings-heading">{copy.warningsPanel}</h2>
      {issues.length === 0 ? (
        <p className="field-help">{t('No current fabrication issues.')}</p>
      ) : null}
      <IssueList issues={issues} />
    </section>
  );
}
