import type { TemplateKind } from '../../domain/folding';
import type { FoldTemplateSettings } from '../../domain/modeSettings';
export type NumericExpression =
  | number
  | { ref: string }
  | {
      op: 'add' | 'sub' | 'mul' | 'div' | 'min' | 'max';
      args: [NumericExpression, NumericExpression];
    }
  | { op: 'clamp'; args: [NumericExpression, NumericExpression, NumericExpression] };
export interface ExpressionPoint {
  x: NumericExpression;
  y: NumericExpression;
}
export interface CustomPanel {
  id: string;
  name: string;
  outline: ExpressionPoint[];
  holes: ExpressionPoint[][];
}
export interface CustomHinge {
  id: string;
  panelA: string;
  panelB: string;
  edgeA: number;
  edgeB: number;
  angleDeg: NumericExpression;
}
export interface CustomTab {
  id: string;
  panelId: string;
  edge: number;
  depthMm: NumericExpression;
  receiverPanelId?: string;
}
export interface CustomMark {
  id: string;
  panelId: string;
  point: ExpressionPoint;
  text: string;
}
export interface AuthorParameter {
  id: string;
  name: { en: string; he: string };
  default: number;
  min: number;
  max: number;
}
interface DefinitionBase {
  id: string;
  version: number;
  names: { en: string; he: string };
  parameters: AuthorParameter[];
}
export type UserTemplateDefinition = DefinitionBase &
  (
    | {
        kind: 'custom';
        panels: CustomPanel[];
        hinges: CustomHinge[];
        tabs: CustomTab[];
        marks: CustomMark[];
      }
    | { kind: 'variant'; legacyKind: TemplateKind; settings: FoldTemplateSettings }
  );
export interface SavedTemplateInstance {
  templateId: string;
  templateVersion: number;
  definitionHash: string;
  values: Record<string, number>;
}
