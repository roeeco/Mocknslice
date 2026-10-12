import { useState } from 'react';
import { useProjectStore } from '../../state/useProjectStore';
import { studioCopy } from '../../locales/studioCopy';

export function ProjectNameField() {
  const name = useProjectStore((state) => state.project.metadata.name),
    locale = useProjectStore((state) => state.locale),
    rename = useProjectStore((state) => state.renameProject);
  const [buffer, setBuffer] = useState<string>();
  const commit = () => {
    if (buffer === undefined || !buffer.trim()) return;
    if (buffer.trim() !== name) rename(buffer.trim());
    setBuffer(undefined);
  };
  return (
    <label className="field-stack studio-project-name">
      <span>{studioCopy(locale).name}</span>
      <input
        value={buffer ?? name}
        data-runtime-draft={buffer !== undefined || undefined}
        aria-invalid={buffer !== undefined && !buffer.trim()}
        onChange={(event) => setBuffer(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') setBuffer(undefined);
        }}
      />
    </label>
  );
}
