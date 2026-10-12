import { constructionRecipeDefinitions, generateConstructionRecipe } from './constructionRecipes';
import { legacyFamilies } from './families/legacyFamilies';
import type { LegacyTemplateGenerator } from './types';
import type { TemplateGraphGenerator } from './types';
import { fromLegacyFoldResult } from '../geometry/designGraph/fromLegacyFoldResult';

export const legacyTemplateGenerators: Readonly<Record<string, LegacyTemplateGenerator>> =
  Object.fromEntries(
    Object.entries(legacyFamilies).map(([kind, generator]) => [`legacy:${kind}`, generator]),
  );

export const templateGraphGenerators: Readonly<Record<string, TemplateGraphGenerator>> =
  Object.fromEntries([
    ...constructionRecipeDefinitions.map(
      (d) =>
        [
          d.generatorId!,
          (values: Record<string, number | string | boolean>, material: { thicknessMm: number }) =>
            generateConstructionRecipe(d.recipeId!, values, material),
        ] as [string, TemplateGraphGenerator],
    ),
    ...Object.entries(legacyTemplateGenerators).map(
      ([id, generate]) =>
        [
          id,
          (values, material) =>
            fromLegacyFoldResult(
              generate({
                materialThicknessMm: material.thicknessMm,
                settings: {
                  templateKind: id.slice('legacy:'.length) as keyof typeof legacyFamilies,
                  fitAxis: 'y',
                  clearanceMm: 0,
                  profileToleranceMm: 1,
                  sizeMode: 'custom',
                  envelopeDimensions: {
                    widthMm: values.widthMm as number,
                    lengthMm: values.lengthMm as number,
                    heightMm: values.heightMm as number,
                  },
                  parameters: { ...values, standalone: true, wallHeightMm: values.heightMm! },
                },
              }),
            ),
        ] as [string, TemplateGraphGenerator],
    ),
  ]);
