const sequences = new Map<string, number>();

// 저장 행 fixture의 id·email 번호다. vitest setup이 테스트마다 1부터 다시 센다
export function nextFixtureSequence(kind: string): number {
  const next = (sequences.get(kind) ?? 0) + 1;
  sequences.set(kind, next);
  return next;
}

export function resetFixtureSequences(): void {
  sequences.clear();
}
