import { describe, expect, it } from 'vitest';
import { createProject } from '../app/createProject';
import { createAssemblyPdf } from './exportPdf';
import { deriveTightOutputLayout } from '../geometry/layout/deriveTightOutputLayout';

function pdfProject() {
  const project = createProject('Assembly guide');
  project.generatedParts = [
    {
      id: 'part-a',
      name: 'Part A',
      label: 'A1',
      thicknessMm: 1,
      paths: [
        {
          id: 'part-a-cut',
          operation: 'cut',
          closed: true,
          contourRole: 'outer',
          points: [
            { x: -5, y: -5 },
            { x: 5, y: -5 },
            { x: 5, y: 5 },
            { x: -5, y: 5 },
          ],
        },
        {
          id: 'part-a-fold',
          operation: 'valley-fold',
          closed: false,
          points: [
            { x: -5, y: 0 },
            { x: 5, y: 0 },
          ],
        },
      ],
    },
  ];
  project.sheetLayouts = [
    {
      id: 'sheet-a',
      widthMm: 100,
      heightMm: 80,
      marginMm: 5,
      spacingMm: 3,
      placements: [{ partId: 'part-a', x: 20, y: 20, rotationDeg: 0 }],
    },
    {
      id: 'sheet-b',
      widthMm: 120,
      heightMm: 90,
      marginMm: 5,
      spacingMm: 3,
      placements: [{ partId: 'part-a', x: 30, y: 30, rotationDeg: 90 }],
    },
  ];
  project.exportSettings.includeRegistrationMarks = true;
  project.exportSettings.foldLineOutput = 'score';
  return project;
}

describe('createAssemblyPdf', () => {
  it('creates a deterministic multi-page vector PDF with labels and operation styles', () => {
    const project = pdfProject();
    const first = createAssemblyPdf(project);
    const second = createAssemblyPdf(project);
    const source = new TextDecoder().decode(first);

    expect(first).toEqual(second);
    expect(source.startsWith('%PDF-1.4')).toBe(true);
    expect(source).toContain('/Type /Pages');
    expect(source).toContain('/Count 2');
    expect(source).toContain('/MediaBox [0 0 283.465 226.772]');
    expect(source).toContain('/MediaBox [0 0 340.157 255.118]');
    expect(source).toContain('(A1) Tj');
    expect(source).toContain('(Assembly guide - sheet 1 of 2) Tj');
    expect(source).toContain('/Producer (MocknSlice fabrication output)');
    expect(source.endsWith('%%EOF\n')).toBe(true);
  });

  it('requires at least one placed part', () => {
    const project = createProject();
    expect(() => createAssemblyPdf(project)).toThrow('Place at least one part');
  });

  it('uses explicit Standard canvas dimensions without replacing Advanced sheets', () => {
    const project = pdfProject();
    const saved = structuredClone(project.sheetLayouts);
    const tight = deriveTightOutputLayout(project.generatedParts);
    const source = new TextDecoder().decode(createAssemblyPdf(project, [tight]));
    const points = (value: number) => Math.round(value * (72 / 25.4) * 1000) / 1000;

    expect(source).toContain(`/MediaBox [0 0 ${points(tight.widthMm)} ${points(tight.heightMm)}]`);
    expect(source).toContain('/Count 1');
    expect(project.sheetLayouts).toEqual(saved);
  });
});
