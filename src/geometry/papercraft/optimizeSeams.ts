import type {
  PapercraftForest,
  PapercraftHalfEdge,
  PapercraftKernelInput,
  PapercraftKernelResult,
  PapercraftRunHooks,
} from '../../domain/papercraft';
import { hashSerializable } from '../../domain/canonicalHash';
import { preparePapercraftSource, papercraftIssue } from './prepareSource';
import { unfoldForest, uniqueSourceEdges } from './unfoldForest';

export { papercraftInputHash } from './inputHash';
import { papercraftInputHash } from './inputHash';
export function compareForests(
  a: PapercraftForest,
  b: PapercraftForest,
  preset: PapercraftKernelInput['settings']['optimizer'] = 'balanced',
): number {
  const rank = (forest: PapercraftForest) =>
    preset === 'compact'
      ? [
          forest.score[0]!,
          forest.score[1]!,
          forest.score[4]!,
          forest.score[2]!,
          forest.score[3]!,
          forest.score[5]!,
        ]
      : forest.score;
  const first = rank(a),
    second = rank(b);
  for (let i = 0; i < first.length; i++) {
    const difference = first[i]! - second[i]!;
    if (Math.abs(difference) > 1e-8) return difference;
  }
  return a.hingeKeys.join(',').localeCompare(b.hingeKeys.join(','));
}
function candidateOrder(
  edges: PapercraftHalfEdge[],
  index: number,
  inputHash: string,
  preset: PapercraftKernelInput['settings']['optimizer'],
): PapercraftHalfEdge[] {
  const tie = (e: PapercraftHalfEdge) =>
    hashSerializable({ seed: inputHash, candidate: index, edge: e.edgeKey });
  return [...edges].sort(
    (a, b) =>
      Number(b.softCoplanar) - Number(a.softCoplanar) ||
      (index === 0
        ? Math.abs(a.signedDihedralDeg ?? 0) - Math.abs(b.signedDihedralDeg ?? 0) ||
          b.lengthMm - a.lengthMm
        : index % 3 === 0
          ? b.lengthMm - a.lengthMm
          : index % 3 === 1
            ? (preset === 'preserve-sharp-edges' ? -1 : 1) *
              (Math.abs(a.signedDihedralDeg ?? 0) - Math.abs(b.signedDihedralDeg ?? 0))
            : 0) ||
      tie(a).localeCompare(tie(b)) ||
      a.edgeKey.localeCompare(b.edgeKey),
  );
}
export function optimizePapercraft(
  input: PapercraftKernelInput,
  hooks: PapercraftRunHooks = {},
): PapercraftKernelResult {
  const checkCancelled = () => {
    if (hooks.cancelled?.())
      throw new DOMException('Papercraft calculation cancelled.', 'AbortError');
  };
  checkCancelled();
  const source = preparePapercraftSource(input);
  let inputHash: string;
  try {
    inputHash = papercraftInputHash(input);
  } catch {
    inputHash = 'invalid';
    source.issues.push(
      papercraftIssue(
        'PAPERCRAFT_INPUT_INVALID',
        [],
        'Input contains nonfinite or nonserializable data.',
      ),
    );
  }
  hooks.progress?.({ stage: 'prepared', done: 1, total: 1 });
  if (source.issues.some((i) => i.severity === 'error'))
    return {
      algorithmVersion: 'papercraft-v2',
      inputHash,
      source,
      faces: [],
      hingeKeys: [],
      islands: [],
      issues: source.issues,
      score: [0, 0, 0, 0, 0, 0],
      searchExhausted: false,
    };
  const edges = uniqueSourceEdges(source),
    preset = input.settings.optimizer;
  let best: PapercraftForest | undefined,
    searchExhausted = false;
  for (let candidate = 0; candidate < input.settings.maxCandidates; candidate++) {
    checkCancelled();
    if (candidate > 0 && hooks.budgetExpired?.()) {
      searchExhausted = true;
      break;
    }
    const forest = unfoldForest(
      source,
      input.settings,
      candidateOrder(edges, candidate, inputHash, preset),
      undefined,
      [],
      () => {
        checkCancelled();
        return hooks.budgetExpired?.() ?? false;
      },
    );
    if (forest.issues.some((i) => i.severity === 'error'))
      return {
        ...forest,
        algorithmVersion: 'papercraft-v2',
        inputHash,
        source,
        searchExhausted: false,
      };
    if (!best || compareForests(forest, best, preset) < 0) best = forest;
    hooks.progress?.({
      stage: 'candidates',
      done: candidate + 1,
      total: input.settings.maxCandidates,
    });
  }
  const forced = new Set(
      input.settings.edgeEdits.filter((e) => e.intent === 'must-join').map((e) => e.id),
    ),
    cuts = new Set(
      input.settings.edgeEdits.filter((e) => e.intent === 'must-cut').map((e) => e.id),
    );
  outer: for (let pass = 0; pass < 2; pass++) {
    const seams = edges.filter((e) => !best!.hingeKeys.includes(e.edgeKey) && !cuts.has(e.edgeKey)),
      removable = best!.hingeKeys.filter((key) => !forced.has(key));
    let swaps = 0,
      improved = false;
    for (const seam of seams)
      for (const removed of removable) {
        checkCancelled();
        if (hooks.budgetExpired?.()) {
          searchExhausted = true;
          break outer;
        }
        if (swaps >= 32) break;
        swaps++;
        const required = [
          ...forced,
          ...best!.hingeKeys.filter((key) => key !== removed && !forced.has(key)),
          seam.edgeKey,
        ];
        const forest = unfoldForest(
          source,
          input.settings,
          candidateOrder(edges, 0, inputHash, preset),
          required,
          [removed],
        );
        if (
          !forest.issues.some((i) => i.severity === 'error') &&
          compareForests(forest, best!, preset) < 0 &&
          forest.score.some((value, i) => Math.abs(value - best!.score[i]!) > 1e-8)
        ) {
          best = forest;
          improved = true;
        }
        hooks.progress?.({ stage: 'optimization', done: pass * 32 + swaps, total: 64 });
      }
    if (!improved) break;
  }
  checkCancelled();
  const result: PapercraftKernelResult = {
    ...best!,
    algorithmVersion: 'papercraft-v2',
    inputHash,
    source,
    searchExhausted,
  };
  if (searchExhausted)
    result.issues.push(
      papercraftIssue(
        'PAPERCRAFT_SEARCH_EXHAUSTED',
        [],
        'Search budget ended; the retained candidate still passes geometry checks.',
        'info',
      ),
    );
  hooks.progress?.({ stage: 'completed', done: 1, total: 1 });
  return result;
}
