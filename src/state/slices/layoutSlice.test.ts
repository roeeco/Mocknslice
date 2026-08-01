import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../../app/createProject';
import type { FabricationPart } from '../../domain/fabrication';
import { useProjectStore } from '../useProjectStore';

function squarePart(id: string): FabricationPart {
  return {
    id,
    name: id,
    thicknessMm: 1,
    paths: [
      {
        id: `${id}-cut`,
        operation: 'cut',
        closed: true,
        points: [
          { x: -5, y: -5 },
          { x: 5, y: -5 },
          { x: 5, y: 5 },
          { x: -5, y: 5 },
        ],
      },
    ],
  };
}

describe('layout state slice', () => {
  beforeEach(() => {
    const project = createProject('Layout state');
    project.generatedParts = [squarePart('a'), squarePart('b')];
    useProjectStore.setState({
      project,
      activeSheetId: project.sheetLayouts[0]?.id,
      past: [],
      future: [],
    });
  });

  it('arranges parts and restores a committed placement through undo', () => {
    useProjectStore.getState().arrangeGeneratedParts();
    const sheet = useProjectStore.getState().project.sheetLayouts[0]!;
    const original = sheet.placements[0]!;

    useProjectStore.getState().updatePartPlacement(sheet.id, 'a', {
      x: original.x + 12,
      y: original.y + 8,
    });
    expect(useProjectStore.getState().project.sheetLayouts[0]?.placements[0]?.x).toBe(
      original.x + 12,
    );

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.sheetLayouts[0]?.placements[0]).toEqual(original);
  });

  it('duplicates sheet settings without duplicating part placements', () => {
    useProjectStore.getState().arrangeGeneratedParts();
    const source = useProjectStore.getState().project.sheetLayouts[0]!;
    useProjectStore.getState().duplicateSheet(source.id);
    const duplicate = useProjectStore.getState().project.sheetLayouts[1]!;

    expect(duplicate).toMatchObject({
      widthMm: source.widthMm,
      heightMm: source.heightMm,
      marginMm: source.marginMm,
      spacingMm: source.spacingMm,
      placements: [],
    });
    expect(duplicate.id).not.toBe(source.id);
  });
});
