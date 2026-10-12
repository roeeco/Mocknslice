import { useState } from 'react';
import { legacyTemplateDefinitions } from '../../templates/definitions';
import type { TemplateDefinition } from '../../templates/types';
import { studioCopy } from '../../locales/studioCopy';
import { useProjectStore } from '../../state/useProjectStore';
import openBox from '../../assets/template-previews/open-box.svg';
import lid from '../../assets/template-previews/box-with-lid.svg';
import tray from '../../assets/template-previews/tray.svg';
import sleeve from '../../assets/template-previews/sleeve.svg';
import envelope from '../../assets/template-previews/envelope.svg';
import prism from '../../assets/template-previews/regular-prism.svg';
import pyramid from '../../assets/template-previews/pyramid-frustum.svg';

const thumbnails: Record<string, string> = {
  'open-box': openBox,
  'box-with-lid': lid,
  tray,
  sleeve,
  envelope,
  'regular-prism': prism,
  'pyramid-frustum': pyramid,
};
export function TemplateCatalog({
  onChoose,
}: {
  onChoose: (definition: TemplateDefinition) => void;
}) {
  const locale = useProjectStore((state) => state.locale),
    c = studioCopy(locale);
  const [search, setSearch] = useState(''),
    [family, setFamily] = useState('all'),
    [reference, setReference] = useState<TemplateDefinition>();
  const definitions = [...legacyTemplateDefinitions];
  const matches = definitions.filter(
    (def) =>
      (family === 'all' || def.family === family) &&
      `${def.names.en} ${def.names.he} ${def.fefcoCode ?? ''} ${def.family}`
        .toLowerCase()
        .includes(search.toLowerCase().trim()),
  );
  const families = [...new Set(definitions.map((def) => def.family))];
  const familyNames = c.families;
  return (
    <section className="studio-catalog" aria-labelledby="catalog-heading">
      <h2 id="catalog-heading">{c.catalogTitle}</h2>
      <div className="catalog-filters">
        <label>
          <span className="visually-hidden">{c.search}</span>
          <input
            type="search"
            placeholder={c.search}
            aria-label={c.search}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <select
          aria-label={c.all}
          value={family}
          onChange={(event) => setFamily(event.target.value)}
        >
          <option value="all">{c.all}</option>
          {families.map((value) => (
            <option key={value} value={value}>
              {familyNames[value]}
            </option>
          ))}
        </select>
      </div>
      <div className="catalog-grid">
        {matches.map((def) => (
          <article className="template-card" key={def.id}>
            {def.legacyKind ? (
              <img src={thumbnails[def.legacyKind]} alt="" loading="lazy" />
            ) : (
              <div className="reference-thumbnail" aria-hidden="true">
                {def.fefcoCode}
              </div>
            )}
            <h3>{def.names[locale]}</h3>
            {def.fefcoCode ? <span dir="ltr">FEFCO {def.fefcoCode}</span> : null}
            <p className={`template-status template-status-${def.status}`}>
              {def.status === 'catalog-only'
                ? c.catalogOnly
                : def.status === 'verified'
                  ? c.verified
                  : c.experimental}
            </p>
            <button
              type="button"
              onClick={() => (def.status === 'catalog-only' ? setReference(def) : onChoose(def))}
            >
              {def.status === 'catalog-only' ? c.inspect : `${c.choose}: ${def.names[locale]}`}
            </button>
          </article>
        ))}
      </div>
      {matches.length === 0 ? <p role="status">{c.noMatches}</p> : null}
      {reference ? (
        <div
          className="studio-reference"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reference-heading"
        >
          <h3 id="reference-heading">
            {reference.names[locale]} <span dir="ltr">{reference.fefcoCode}</span>
          </h3>
          <p>{c.inspectOnly}</p>
          <button type="button" autoFocus onClick={() => setReference(undefined)}>
            {c.close}
          </button>
        </div>
      ) : null}
    </section>
  );
}
