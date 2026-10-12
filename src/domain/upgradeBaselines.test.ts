/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createAssemblyPdf } from '../exporters/exportPdf';
import { serializeProject } from '../exporters/exportProject';
import { createSheetSvgDocument } from '../exporters/exportSvg';
import { parseProjectFile } from '../exporters/importProject';
import { generateUpgradeBaseline, upgradeBaselineCases } from '../test-fixtures/upgradeBaseline';
import { deriveGenerationState } from './generation';

function golden(path: string) {
  return readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../test-fixtures/upgrade-baseline', path),
  );
}

// Compare the wire representation: JSON intentionally normalizes -0 to 0 and
// omits undefined properties. No geometric rounding or provenance is removed.
function serialized(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe('MocknSlice 2.0 PR 0 frozen baseline', () => {
  it.each(upgradeBaselineCases)('preserves $id geometry and vector exports', (fixture) => {
    const actual = generateUpgradeBaseline(fixture);
    const expected = JSON.parse(golden(`geometry/${fixture.id}.json`).toString('utf8'));
    expect(serialized(actual)).toEqual(expected);
    expect(actual.result.parts.length).toBeGreaterThan(0);

    for (const [index, sheet] of actual.project.sheetLayouts.entries()) {
      const svg = createSheetSvgDocument(actual.project, sheet.id);
      expect(svg).toBe(golden(`geometry/${fixture.id}-sheet-${index + 1}.svg`).toString('utf8'));
      const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
      expect(document.querySelector('parsererror')).toBeNull();
      expect(document.documentElement.getAttribute('width')).toBe(`${sheet.widthMm}mm`);
      expect(document.documentElement.getAttribute('height')).toBe(`${sheet.heightMm}mm`);
      expect(document.documentElement.getAttribute('viewBox')).toBe(
        `0 0 ${sheet.widthMm} ${sheet.heightMm}`,
      );
      expect(document.querySelectorAll('path').length).toBeGreaterThan(0);
    }
    expect(Array.from(createAssemblyPdf(actual.project))).toEqual(
      Array.from(golden(`geometry/${fixture.id}.pdf`)),
    );
    expect(serialized(parseProjectFile(serializeProject(actual.project)))).toEqual(
      serialized(actual.project),
    );
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    'preserves the frozen v%i project on import and round-trip',
    (version) => {
      const source = golden(`projects/v${version}.mocknslice.json`).toString('utf8');
      expect(JSON.parse(source).version).toBe(version);
      const expected = JSON.parse(golden(`projects/v${version}-expected.json`).toString('utf8'));
      const restored = parseProjectFile(source);
      expect(serialized(restored)).toEqual(expected);
      expect(restored.generatedParts.length).toBeGreaterThan(0);
      expect(serialized(parseProjectFile(serializeProject(restored)))).toEqual(expected);
    },
  );

  it('retains v7 output but requires regeneration after connection migration', () => {
    const project = parseProjectFile(golden('projects/v7.mocknslice.json').toString('utf8'));
    expect(project.modeSettings.panelConstruction.connectionOverrides['base-front']).toEqual({
      treatment: 'butt',
    });
    expect(deriveGenerationState(project)).toBe('legacy-unverified');
    expect(project.generationIssues?.map((issue) => issue.code)).toContain(
      'CONNECTION_TOPOLOGY_REGENERATION_REQUIRED',
    );
  });

  it('records the existing nonzero-top-scale frustum cap defect without declaring it ready', () => {
    const fixture = upgradeBaselineCases.find((entry) => entry.id === 'fold-pyramid-frustum')!;
    const { project, result } = generateUpgradeBaseline(fixture);
    expect(
      result.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.code),
    ).toEqual([
      'FOLD_CONNECTION_PANEL_MISSING',
      'FOLD_CONNECTION_PANEL_MISSING',
      'FOLD_CONNECTION_PANEL_MISSING',
      'FOLD_CONNECTION_PANEL_MISSING',
    ]);
    expect(deriveGenerationState(project)).toBe('invalid');
  });
});
