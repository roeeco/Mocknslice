import type { ClassroomRecipeId } from '../domain/classroomRecipes';
import type { FabricationDesignGraph } from '../domain/designGraph';
import type { TemplateKind, TemplateGenerationResult } from '../domain/folding';
import type { FoldTemplateInput } from '../geometry/folding/generateFoldTemplate';

export type ParamValue = number | boolean | string;
export interface TemplateParameter {
  id: string;
  labelKey: string;
  kind: 'length' | 'integer' | 'angle' | 'ratio' | 'enum' | 'boolean';
  default: ParamValue;
  min?: number;
  max?: number;
  step?: number;
  choices?: string[];
  displayGroup: 'size' | 'material' | 'closure' | 'advanced';
}
export interface TemplateDefinition {
  recipeId?: ClassroomRecipeId;
  id: string;
  version: number;
  family: 'carton' | 'tray' | 'sleeve' | 'lid-base' | 'polyhedron' | 'organizer' | 'custom';
  fefcoCode?: string;
  labelKey: string;
  descriptionKey: string;
  names: { en: string; he: string };
  thumbnail: string;
  status: 'verified' | 'experimental' | 'catalog-only';
  parameters: TemplateParameter[];
  generatorId?: string;
  legacyKind?: TemplateKind;
  /** Digital validation and physical inspection are recorded separately. */
  inspection?: { reference: string; physicallyInspected: boolean };
}
export interface TemplateInstance {
  templateId: string;
  templateVersion: number;
  values: Record<string, ParamValue>;
}
export type LegacyTemplateGenerator = (input: FoldTemplateInput) => TemplateGenerationResult;
export type TemplateGraphGenerator = (
  values: Record<string, ParamValue>,
  material: { thicknessMm: number },
) => FabricationDesignGraph;
