import type { PropsWithChildren } from 'react';
import { copy } from '../../locales';

export function AdvancedSettingsSection({ children }: PropsWithChildren) {
  return (
    <section className="advanced-settings-section" aria-label={copy.advancedSettings}>
      <h3>{copy.advancedSettings}</h3>
      {children}
    </section>
  );
}
