export const MEMO_MUTATION_KEYS = {
  parse: ({ memoId }: { memoId: number }) => ['memo', 'parse', { memoId }] as const,
} as const;
