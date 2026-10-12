import { describe, expect, it } from 'vitest';
import { generateUpgradeBaseline, upgradeBaselineCases } from '../../test-fixtures/upgradeBaseline';
import { preservePlacements } from './preservePlacements';
import { validateSheetLayouts } from './validateSheetLayouts';

describe('stable placement retention', () => {
  it('retains rotation and translation after resizing and exposes off-sheet review', () => {
    const { project } = generateUpgradeBaseline(upgradeBaselineCases[0]!);
    project.sheetLayouts[0]!.placements[0] = {
      partId: project.generatedParts[0]!.id,
      x: 550,
      y: 100,
      rotationDeg: 90,
    };
    const previous = JSON.stringify(project.sheetLayouts);
    const enlarged = project.generatedParts.map((part) => ({
      ...part,
      paths: part.paths.map((path) => ({
        ...path,
        points: path.points.map((point) => ({ x: point.x * 4, y: point.y * 4 })),
      })),
    }));
    const layouts = preservePlacements(project.sheetLayouts, project.generatedParts, enlarged);
    expect(layouts[0]!.placements[0]).toEqual(project.sheetLayouts[0]!.placements[0]);
    expect(
      validateSheetLayouts({ ...project, generatedParts: enlarged, sheetLayouts: layouts }).some(
        (issue) => issue.code === 'PART_OUTSIDE_SHEET',
      ),
    ).toBe(true);
    expect(JSON.stringify(project.sheetLayouts)).toBe(previous);
  });
  it('places only newly added pieces on extra sheets and is repeatable', () => {
    const { project } = generateUpgradeBaseline(upgradeBaselineCases[0]!);
    const added = { ...project.generatedParts[0]!, id: 'new-piece' };
    const next = [...project.generatedParts, added];
    const first = preservePlacements(project.sheetLayouts, project.generatedParts, next);
    expect(first[0]).toEqual(project.sheetLayouts[0]);
    expect(first[1]!.placements.map((p) => p.partId)).toEqual(['new-piece']);
    expect(preservePlacements(first, next, next)).toEqual(first);
  });
});
