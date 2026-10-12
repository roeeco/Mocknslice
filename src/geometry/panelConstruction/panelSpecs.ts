import type {
  PanelConstructionMaterial,
  PanelConstructionSettings,
} from '../../domain/panelConstruction';
import type { PanelSpec } from './constructionTypes';
import { dividerCountsFor, dividerThicknessMm, panelThicknessMm } from './constructionHelpers';
import { dividerTabCentres, dividerTabWidth } from './fingerJoints';

export function panelSpecs(
  settings: PanelConstructionSettings,
  material: PanelConstructionMaterial,
): PanelSpec[] {
  const wallThickness = panelThicknessMm(settings, material);
  const outerWidth = settings.innerWidthMm + wallThickness * 2;
  const specs: PanelSpec[] = [
    {
      role: 'base',
      name: 'Base panel',
      widthMm: settings.innerWidthMm,
      heightMm: settings.innerDepthMm,
    },
    {
      role: 'front',
      name: 'Front panel',
      widthMm: outerWidth,
      heightMm: settings.innerHeightMm,
      profile: settings.panelProfiles?.front ?? 'flat',
    },
    {
      role: 'back',
      name: 'Back panel',
      widthMm: outerWidth,
      heightMm: settings.innerHeightMm,
      profile: settings.panelProfiles?.back ?? 'flat',
    },
    {
      role: 'left',
      name: 'Left panel',
      widthMm: settings.innerDepthMm,
      heightMm: settings.innerHeightMm,
    },
    {
      role: 'right',
      name: 'Right panel',
      widthMm: settings.innerDepthMm,
      heightMm: settings.innerHeightMm,
    },
  ];
  if (settings.includeLid) {
    specs.push({
      role: 'lid',
      name: 'Lid panel',
      widthMm: settings.innerWidthMm,
      heightMm: settings.innerDepthMm,
    });
  }
  const counts = dividerCountsFor(settings);
  const dividerThickness = dividerThicknessMm(settings, material);
  const widthCellDepth =
    (settings.innerDepthMm - counts.width * dividerThickness) / (counts.width + 1);
  const depthCellWidth =
    (settings.innerWidthMm - counts.depth * dividerThickness) / (counts.depth + 1);
  const widthPositions = Array.from(
    { length: counts.width },
    (_, index) =>
      -settings.innerDepthMm / 2 + widthCellDepth * (index + 1) + dividerThickness * (index + 0.5),
  );
  const depthPositions = Array.from(
    { length: counts.depth },
    (_, index) =>
      -settings.innerWidthMm / 2 + depthCellWidth * (index + 1) + dividerThickness * (index + 0.5),
  );
  let dividerIndex = 0;
  for (const position of widthPositions) {
    dividerIndex += 1;
    specs.push({
      role: `divider-${dividerIndex}`,
      name: `Width divider ${dividerIndex}`,
      widthMm: settings.innerWidthMm,
      heightMm: settings.innerHeightMm,
      dividerAxis: 'width',
      dividerPositionMm: position,
      crossingSlotCentresMm: depthPositions,
      tabCentresMm: [-settings.innerWidthMm / 4, settings.innerWidthMm / 4],
    });
  }
  for (const position of depthPositions) {
    dividerIndex += 1;
    const tabWidth = dividerTabWidth(settings.innerDepthMm, dividerThickness);
    const crossingWidth = dividerThickness + settings.clearanceMm;
    specs.push({
      role: `divider-${dividerIndex}`,
      name: `Depth divider ${dividerIndex - counts.width}`,
      widthMm: settings.innerDepthMm,
      heightMm: settings.innerHeightMm,
      dividerAxis: 'depth',
      dividerPositionMm: position,
      crossingSlotCentresMm: widthPositions,
      tabCentresMm: dividerTabCentres(
        settings.innerDepthMm,
        tabWidth,
        widthPositions,
        crossingWidth,
      ),
    });
  }
  return specs;
}
