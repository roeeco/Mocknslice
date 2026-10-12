import type { FabricationPart } from '../../domain/fabrication';
import type {
  AssembledFoldPanel,
  FoldPanel,
  FoldEdgeDefinition,
  FoldConnection,
  FoldTab,
} from '../../domain/folding';
import type { ValidationIssue } from '../../domain/validation';

export interface BuiltTemplate {
  panels: FoldPanel[];
  edges: FoldEdgeDefinition[];
  connections: FoldConnection[];
  tabs: FoldTab[];
  parts: FabricationPart[];
  assembled: AssembledFoldPanel[];
  issues: ValidationIssue[];
}
