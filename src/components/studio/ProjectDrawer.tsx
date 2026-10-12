import { useEffect, useState } from 'react';
import { projectRepository } from '../../persistence/database';
import { useProjectStore } from '../../state/useProjectStore';
import type { ProjectMetadata } from '../../domain/project';
import { parseProjectFile } from '../../exporters/importProject';
import { studioCopy } from '../../locales/studioCopy';

export function ProjectDrawer({ onClose, onOpen }: { onClose: () => void; onOpen: () => void }) {
  const project = useProjectStore((state) => state.project),
    locale = useProjectStore((state) => state.locale),
    replace = useProjectStore((state) => state.replaceProject),
    create = useProjectStore((state) => state.createNewProject),
    cancel = useProjectStore((state) => state.cancelSliceGeneration);
  const c = studioCopy(locale),
    [records, setRecords] = useState<ProjectMetadata[]>([]),
    [name, setName] = useState(project.metadata.name),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void projectRepository
      .list()
      .then((list) => {
        if (active) setRecords(list);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', close);
    return () => {
      active = false;
      window.removeEventListener('keydown', close);
    };
  }, [onClose]);
  const open = async (id: string) => {
    try {
      const loaded = await projectRepository.get(id);
      if (!loaded) throw new Error('Missing project.');
      cancel();
      replace(loaded);
      onOpen();
      onClose();
    } catch {
      setFailed(true);
    }
  };
  const saveCopy = async () => {
    if (!name.trim()) return;
    try {
      const copy = {
        ...structuredClone(project),
        metadata: {
          ...project.metadata,
          id: `project-${crypto.randomUUID()}`,
          name: name.trim(),
          updatedAt: new Date().toISOString(),
        },
      };
      await projectRepository.save(copy);
      cancel();
      replace(copy);
      setRecords(await projectRepository.list());
    } catch {
      setFailed(true);
    }
  };
  return (
    <aside
      className="studio-project-drawer"
      role="dialog"
      aria-modal="false"
      aria-labelledby="projects-title"
    >
      <div className="panel-heading-row">
        <h2 id="projects-title">{c.projects}</h2>
        <button type="button" autoFocus onClick={onClose}>
          {c.close}
        </button>
      </div>
      <label className="field-stack">
        <span>{c.name}</span>
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <button type="button" onClick={() => void saveCopy()} disabled={!name.trim()}>
        {c.saveCopy}
      </button>
      <button
        type="button"
        onClick={() => {
          cancel();
          create();
          onOpen();
          onClose();
        }}
      >
        {c.newProject}
      </button>
      <label className="field-stack">
        <span>{c.importProject}</span>
        <input
          type="file"
          accept=".mocknslice.json,.slicefold.json,application/json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            void (async () => {
              try {
                if (file.size > 20 * 1024 * 1024) throw new Error('Project exceeds limit.');
                const loaded = parseProjectFile(await file.text());
                cancel();
                replace(loaded);
                onOpen();
                onClose();
              } catch {
                setFailed(true);
              }
            })();
          }}
        />
      </label>
      {failed ? <p role="alert">{c.projectFailure}</p> : null}
      {records.length ? (
        records.map((record) => (
          <div className="saved-project-row" key={record.id}>
            <span>{record.name}</span>
            <button type="button" onClick={() => void open(record.id)}>
              {c.open}
            </button>
          </div>
        ))
      ) : (
        <p>{c.noProjects}</p>
      )}
    </aside>
  );
}
