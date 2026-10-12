import type { NumericExpression, UserTemplateDefinition, ExpressionPoint } from './types';
const ref = (name: string): NumericExpression => ({ ref: name });
const neg = (value: NumericExpression): NumericExpression => ({ op: 'mul', args: [-1, value] });
const add = (a: NumericExpression, b: NumericExpression): NumericExpression => ({
  op: 'add',
  args: [a, b],
});
const rect = (
  left: NumericExpression,
  bottom: NumericExpression,
  right: NumericExpression,
  top: NumericExpression,
): ExpressionPoint[] => [
  { x: left, y: bottom },
  { x: right, y: bottom },
  { x: right, y: top },
  { x: left, y: top },
];
/** Original cross-shaped tray. Shared hinges keep the explicit authored topology. */
export function crossTrayDefinition(id = 'custom:cross-tray'): UserTemplateDefinition {
  const w = ref('widthMm'),
    l = ref('lengthMm'),
    h = ref('heightMm');
  return {
    id,
    version: 1,
    kind: 'custom',
    names: { en: 'Cross tray', he: 'מגש צלב' },
    parameters: [
      ['widthMm', 'Width', 'רוחב', 80],
      ['lengthMm', 'Length', 'אורך', 60],
      ['heightMm', 'Height', 'גובה', 25],
    ].map(([key, en, he, value]) => ({
      id: key as string,
      name: { en: en as string, he: he as string },
      default: value as number,
      min: 5,
      max: 1000,
    })),
    panels: [
      { id: 'base', name: 'BASE', outline: rect(0, 0, w, l), holes: [] },
      { id: 'front', name: 'FRONT', outline: rect(0, neg(h), w, 0), holes: [] },
      { id: 'back', name: 'BACK', outline: rect(0, l, w, add(l, h)), holes: [] },
      { id: 'left', name: 'LEFT', outline: rect(neg(h), 0, 0, l), holes: [] },
      { id: 'right', name: 'RIGHT', outline: rect(w, 0, add(w, h), l), holes: [] },
    ],
    hinges: [
      { id: 'hinge-front', panelA: 'base', panelB: 'front', edgeA: 0, edgeB: 2, angleDeg: -90 },
      { id: 'hinge-right', panelA: 'base', panelB: 'right', edgeA: 1, edgeB: 3, angleDeg: -90 },
      { id: 'hinge-back', panelA: 'base', panelB: 'back', edgeA: 2, edgeB: 0, angleDeg: -90 },
      { id: 'hinge-left', panelA: 'base', panelB: 'left', edgeA: 3, edgeB: 1, angleDeg: -90 },
    ],
    tabs: [],
    marks: [
      {
        id: 'base-label',
        panelId: 'base',
        text: 'CROSS TRAY',
        point: { x: { op: 'div', args: [w, 2] }, y: { op: 'div', args: [l, 2] } },
      },
    ],
  };
}
