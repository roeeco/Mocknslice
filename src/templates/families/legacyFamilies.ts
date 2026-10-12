import type { TemplateKind } from '../../domain/folding';
import { generateFoldTemplate } from '../../geometry/folding/generateFoldTemplate';
import type { LegacyTemplateGenerator } from '../types';

/** Registered wrappers retain the current result/provenance contract. */
function family(kind: TemplateKind): LegacyTemplateGenerator {
  return (input) =>
    generateFoldTemplate({ ...input, settings: { ...input.settings, templateKind: kind } });
}
export const legacyFamilies: Readonly<Record<TemplateKind, LegacyTemplateGenerator>> = {
  'open-box': family('open-box'),
  'box-with-lid': family('box-with-lid'),
  tray: family('tray'),
  sleeve: family('sleeve'),
  envelope: family('envelope'),
  'regular-prism': family('regular-prism'),
  'pyramid-frustum': family('pyramid-frustum'),
};
