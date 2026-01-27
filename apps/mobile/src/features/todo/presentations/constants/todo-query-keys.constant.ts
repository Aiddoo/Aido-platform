export const TODO_QUERY_KEYS = {
  all: ['todo'] as const,
  byDate: (date: string) => [...TODO_QUERY_KEYS.all, 'byDate', date] as const,
  counts: (startDate: string, endDate: string) =>
    [...TODO_QUERY_KEYS.all, 'counts', startDate, endDate] as const,
} as const;
