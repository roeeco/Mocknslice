import { CLASSROOM_RECIPES, resolveClassroomRecipeSettings } from '../domain/classroomRecipes';
import type { ClassroomRecipeId } from '../domain/classroomRecipes';
import type { TemplateDefinition } from './types';
import { generateReliableConstruction } from '../geometry/panelConstruction/generateReliableConstruction';
import { makeLegacyPanel, registerEdge } from '../geometry/designGraph/adapterHelpers';
import { logicalPanelEdge } from '../geometry/panelConstruction/panelEdgeEdits';
import { legacyManufacturingFeatures } from '../geometry/designGraph/legacyFeatures';
import { validateGraph } from '../geometry/designGraph/validateGraph';
import { signedArea } from '../geometry/designGraph/polygons';
import type { FabricationDesignGraph } from '../domain/designGraph';
export const constructionRecipeDefinitions: TemplateDefinition[] = CLASSROOM_RECIPES.map(
  (recipe) => ({
    id: `construction:${recipe.id}`,
    version: recipe.revision,
    family: 'organizer',
    recipeId: recipe.id,
    names: recipe.title,
    labelKey: `recipe.${recipe.id}`,
    descriptionKey: `recipe.${recipe.id}.description`,
    thumbnail: `generated:${recipe.id}`,
    status: 'experimental',
    generatorId: `construction:${recipe.id}`,
    parameters: [
      ['widthMm', recipe.settingsFactory({ thicknessMm: 1, clearanceMm: 0.1 }).innerWidthMm],
      ['lengthMm', recipe.settingsFactory({ thicknessMm: 1, clearanceMm: 0.1 }).innerDepthMm],
      ['heightMm', recipe.settingsFactory({ thicknessMm: 1, clearanceMm: 0.1 }).innerHeightMm],
    ].map(([id, value]) => ({
      id: id as string,
      labelKey: `template.${id}`,
      kind: 'length',
      default: value as number,
      min: 10,
      max: 1000,
      displayGroup: 'size',
    })),
  }),
);
export function generateConstructionRecipe(
  id: ClassroomRecipeId,
  values: Record<string, number | string | boolean>,
  material: { thicknessMm: number },
) {
  const settings = resolveClassroomRecipeSettings(id, {
    thicknessMm: material.thicknessMm,
    clearanceMm: 0.1,
  });
  Object.assign(settings, {
    innerWidthMm: values.widthMm,
    innerDepthMm: values.lengthMm,
    innerHeightMm: values.heightMm,
  });
  const result = generateReliableConstruction({
    sourceId: `construction:${id}`,
    material: {
      id: 'custom-stock',
      category: 'custom',
      thicknessMm: material.thicknessMm,
      kerfMm: 0,
    },
    settings,
  });
  const panels = result.panels.map((p) =>
    makeLegacyPanel(
      p,
      result.parts.find((part) => part.id === p.partId)!.thicknessMm,
      result.assembledPreview.panels.find((a) => a.id === p.id)?.verticesMm,
      result.parts
        .find((part) => part.id === p.partId)!
        .paths.filter((path) => path.contourRole === 'hole')
        .map((path) => (signedArea(path.points) > 0 ? [...path.points].reverse() : path.points)),
    ),
  );
  const byId = new Map(panels.map((p) => [p.id, p]));
  const graph: FabricationDesignGraph = {
    schemaVersion: 1,
    units: 'mm',
    source: {
      kind: 'panel-construction',
      sourceId: `construction:${id}`,
      algorithmVersion: result.algorithmVersion,
      inputHash: result.inputHash,
    },
    panels,
    connections: result.joints.map((joint) => {
      const a = byId.get(joint.panelAId)!,
        b = byId.get(joint.panelBId)!;
      const edge = (
        panelId: string,
        location: typeof joint.edgeA,
        centre?: { x: number; y: number },
      ) =>
        location !== 'face'
          ? logicalPanelEdge(
              result.panels.find((p) => p.id === panelId)!,
              location,
              joint.sharedLengthMm,
            )
          : {
              start: { x: centre?.x ?? 0, y: (centre?.y ?? 0) - joint.sharedLengthMm / 2 },
              end: { x: centre?.x ?? 0, y: (centre?.y ?? 0) + joint.sharedLengthMm / 2 },
            };
      const ea = edge(a.id, joint.edgeA, joint.receiverCentreAMm),
        eb = edge(b.id, joint.edgeB, joint.receiverCentreMm);
      return {
        id: joint.id,
        panelAId: a.id,
        panelBId: b.id,
        edgeA: registerEdge(a, joint.id, ea.start, ea.end),
        edgeB: registerEdge(b, joint.id, eb.start, eb.end),
        treatment: joint.kind === 'butt' ? ('butt' as const) : ('finger' as const),
        flatJoined: false,
        closure: 'press-fit' as const,
        required: true,
      };
    }),
    ...legacyManufacturingFeatures(result.parts),
    issues: result.issues,
    manufacturingStatus: result.issues.some((i) => i.severity === 'error')
      ? 'legacy-unverified'
      : 'validated',
  };
  graph.issues.push(...validateGraph(graph));
  return graph;
}
