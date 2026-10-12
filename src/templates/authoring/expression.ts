import type { NumericExpression } from './types';
/** Closed numeric language. No source strings, functions, property lookup or evaluation. */
export function evaluateExpression(
  expression: NumericExpression,
  values: Readonly<Record<string, number>>,
  depth = 0,
  budget = { nodes: 0 },
): number {
  if (depth > 16 || ++budget.nodes > 2000)
    throw new Error('Expression exceeds depth or node budget.');
  let value: number;
  if (typeof expression === 'number') value = expression;
  else if (expression && typeof expression === 'object' && 'ref' in expression) {
    if (Object.keys(expression).length !== 1 || !Object.hasOwn(values, expression.ref))
      throw new Error('Unknown expression reference.');
    value = values[expression.ref]!;
  } else if (expression && typeof expression === 'object' && 'op' in expression) {
    if (
      Object.keys(expression).some((key) => !['op', 'args'].includes(key)) ||
      !Array.isArray(expression.args) ||
      expression.args.length !== (expression.op === 'clamp' ? 3 : 2)
    )
      throw new Error('Invalid numeric operation.');
    const args: number[] = expression.args.map((arg) =>
      evaluateExpression(arg, values, depth + 1, budget),
    );
    const a = args[0]!,
      b = args[1]!;
    switch (expression.op) {
      case 'add':
        value = a + b;
        break;
      case 'sub':
        value = a - b;
        break;
      case 'mul':
        value = a * b;
        break;
      case 'div':
        if (b === 0) throw new Error('Division by zero.');
        value = a / b;
        break;
      case 'min':
        value = Math.min(a, b);
        break;
      case 'max':
        value = Math.max(a, b);
        break;
      case 'clamp':
        if (b > args[2]!) throw new Error('Reversed clamp bounds.');
        value = Math.max(b, Math.min(args[2]!, a));
        break;
      default:
        throw new Error('Unknown numeric operation.');
    }
  } else throw new Error('Invalid numeric expression.');
  if (!Number.isFinite(value) || Math.abs(value) > 100000)
    throw new Error('Numeric result exceeds supported millimetre bounds.');
  return value;
}
