export const TODO_QUERY_KEYS = {
  all: ['todo'] as const,
  byDate: (date: string) => [...TODO_QUERY_KEYS.all, 'byDate', date] as const,
} as const;
