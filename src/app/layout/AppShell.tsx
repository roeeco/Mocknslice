import type { PropsWithChildren } from 'react';
import { copy } from '../../locales/en';
import { WorkflowNavigation } from '../../components/workflow/WorkflowNavigation';
import { ParameterPanel } from '../../components/panels/ParameterPanel';
import { WarningPanel } from '../../components/panels/WarningPanel';
import { ModelImportPanel } from '../../components/panels/ModelImportPanel';
import { ModelInspectionPanel } from '../../components/panels/ModelInspectionPanel';
import { StackedSlicePanel } from '../../components/panels/StackedSlicePanel';
import { LayoutPanel } from '../../components/panels/LayoutPanel';
import { WaffleSlicePanel } from '../../components/panels/WaffleSlicePanel';
import { FoldTemplatePanel } from '../../components/panels/FoldTemplatePanel';
import { FabricationOutputPanel } from '../../components/panels/FabricationOutputPanel';
import { MeshUnfoldPanel } from '../../components/panels/MeshUnfoldPanel';
import { PanelConstructionPanel } from '../../components/panels/PanelConstructionPanel';
import { AppHeader } from './AppHeader';

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <AppHeader />
      <aside className="left-sidebar">
        <div className="sidebar-title">
          <p className="eyebrow">Workspace</p>
          <h1>{copy.projectPanel}</h1>
        </div>
        <WorkflowNavigation />
        <div className="local-first-note">
          <span aria-hidden="true">●</span>
          <div>
            <strong>Local-first</strong>
            <p>Projects stay in this browser unless you export them.</p>
          </div>
        </div>
      </aside>
      <main className="main-workspace">{children}</main>
      <aside className="right-sidebar">
        <ParameterPanel />
        <StackedSlicePanel />
        <WaffleSlicePanel />
        <FoldTemplatePanel />
        <MeshUnfoldPanel />
        <PanelConstructionPanel />
        <LayoutPanel />
        <FabricationOutputPanel />
        <ModelImportPanel />
        <ModelInspectionPanel />
        <WarningPanel />
      </aside>
    </div>
  );
}
