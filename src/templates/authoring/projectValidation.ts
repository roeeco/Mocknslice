import { generateNativeTemplate } from '../generateNativeTemplate';
import {
  buildCanonicalGenerationInput,
  canonicalGenerationSignature,
} from '../../domain/generationInputs';
import * as v from 'valibot';
import type { ProjectData } from '../../domain/project';
import { parseTemplateDefinition, authorInstance } from './validate';
import { unresolvedPapercraftEditsSchema, designGraphSchema } from '../../domain/papercraftSchema';
import { validateGraph } from '../../geometry/designGraph/validateGraph';
import { compileToParts } from '../../geometry/designGraph/compileToParts';
import { hashSerializable } from '../../domain/canonicalHash';
export function validateEmbeddedTemplates(project: ProjectData) {
  if (project.unresolvedEdits) {
    const parsed = v.safeParse(unresolvedPapercraftEditsSchema, project.unresolvedEdits);
    if (
      !parsed.success ||
      new Set(project.unresolvedEdits.map((e) => e.id)).size !== project.unresolvedEdits.length
    )
      throw new Error('Unresolved source edits are malformed.');
    project.unresolvedEdits = parsed.output;
  }

  if (project.templateDefinitions) {
    if (!Array.isArray(project.templateDefinitions) || project.templateDefinitions.length > 50)
      throw new Error('Too many embedded template definitions.');
    project.templateDefinitions = project.templateDefinitions.map(parseTemplateDefinition);
    const keys = project.templateDefinitions.map((d) => `${d.id}:${d.version}`);
    if (new Set(keys).size !== keys.length) throw new Error('Duplicate definition versions.');
  }
  const instance = project.templateInstance;
  if (instance) {
    const definition = project.templateDefinitions?.find(
      (d) => d.id === instance.templateId && d.version === instance.templateVersion,
    );
    if (!definition) throw new Error('Locked template definition is missing.');
    const expected = authorInstance(definition, instance.values);
    if (hashSerializable(expected) !== hashSerializable(instance))
      throw new Error('Locked template values or definition hash are invalid.');
  }
  if (project.designGraph) {
    const parsed = v.safeParse(designGraphSchema, project.designGraph);
    if (!parsed.success || validateGraph(project.designGraph).some((i) => i.severity === 'error'))
      throw new Error('Embedded design graph is invalid.');
    if (
      project.fabricationMode === 'fold-template' &&
      hashSerializable(compileToParts(project.designGraph).parts) !==
        hashSerializable(project.generatedParts)
    )
      throw new Error('Design graph differs from saved manufacturing parts.');
    if (
      project.fabricationMode === 'fold-template' &&
      project.designGraph.source.inputHash === canonicalGenerationSignature(project).inputHash
    ) {
      const input = buildCanonicalGenerationInput(project);
      if (input.mode !== 'fold-template') throw new Error('Wrong graph mode');
      const regenerated = generateNativeTemplate(input.payload);
      if (hashSerializable(regenerated.graph) !== hashSerializable(project.designGraph))
        throw new Error('Saved template graph does not match its locked source definition.');
    }
  }
}
