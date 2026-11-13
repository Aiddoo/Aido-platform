export const MEMO_MUTATION_KEYS = {
  all: ['memo', 'mutation'] as const,
  /** 같은 메모의 글 수정·고정. 응답이 겹치면 마지막 쓰기가 서버 값으로 맞춘다 */
  writes: ({ memoId }: { memoId: number }) =>
    [...MEMO_MUTATION_KEYS.all, 'write', { memoId }] as const,
  parse: ({ memoId }: { memoId: number }) =>
    [...MEMO_MUTATION_KEYS.all, 'parse', { memoId }] as const,
} as const;
