export function traceRegionBoundary(edges: readonly [number, number][]): number[][] {
  const remaining = new Set(edges.map(([a, b]) => `${a}:${b}`));
  const adjacent = new Map<number, number[]>();
  for (const [a, b] of edges) {
    adjacent.set(a, [...(adjacent.get(a) ?? []), b]);
    adjacent.set(b, [...(adjacent.get(b) ?? []), a]);
  }
  const loops: number[][] = [];
  while (remaining.size) {
    const [seed] = remaining;
    const [firstText, secondText] = seed!.split(':');
    const first = Number(firstText);
    let previous = first;
    let current = Number(secondText);
    remaining.delete(seed!);
    const loop = [first, current];
    while (current !== first) {
      const next = (adjacent.get(current) ?? [])
        .filter((candidate) => candidate !== previous)
        .sort((a, b) => a - b)
        .find((candidate) =>
          remaining.has(`${Math.min(current, candidate)}:${Math.max(current, candidate)}`),
        );
      if (next === undefined) break;
      remaining.delete(`${Math.min(current, next)}:${Math.max(current, next)}`);
      previous = current;
      current = next;
      if (current !== first) loop.push(current);
    }
    if (current === first && loop.length >= 3) loops.push(loop);
  }
  return loops.sort((a, b) => a[0]! - b[0]!);
}
