export const SUGGESTION_QUERY_KEYS = {
  all: ['ai', 'suggestions'] as const,
  suggestions: () => SUGGESTION_QUERY_KEYS.all,
} as const;
