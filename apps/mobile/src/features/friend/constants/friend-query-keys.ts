export const FRIEND_QUERY_KEYS = {
  all: ['friend'] as const,
  received: () => [...FRIEND_QUERY_KEYS.all, 'received'] as const,
  sent: () => [...FRIEND_QUERY_KEYS.all, 'sent'] as const,
  friends: () => [...FRIEND_QUERY_KEYS.all, 'friends'] as const,
  searches: () => [...FRIEND_QUERY_KEYS.all, 'search'] as const,
  search: ({ query }: { query: string }) => [...FRIEND_QUERY_KEYS.searches(), { query }] as const,
} as const;
