export const MEMO_MUTATION_KEYS = {
  all: ['memo', 'mutation'] as const,
  parse: ({ memoId }: { memoId: number }) =>
    [...MEMO_MUTATION_KEYS.all, 'parse', { memoId }] as const,
} as const;
