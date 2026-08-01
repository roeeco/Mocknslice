import type { PropsWithChildren } from 'react';
import { copy } from '../../locales';
import { WorkflowNavigation } from '../../components/workflow/WorkflowNavigation';
import { WorkflowPanel } from '../../components/workflow/WorkflowPanel';
import { AppHeader } from './AppHeader';

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <AppHeader />
      <aside className="left-sidebar">
        <div className="sidebar-title">
          <p className="eyebrow">{copy.workspace}</p>
          <h1>{copy.projectPanel}</h1>
        </div>
        <WorkflowNavigation />
      </aside>
      <main className="main-workspace">{children}</main>
      <aside className="right-sidebar">
        <WorkflowPanel />
      </aside>
    </div>
  );
}
