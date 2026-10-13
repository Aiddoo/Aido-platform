export const FRIEND_QUERY_KEYS = {
  all: ['friend'] as const,
  received: () => [...FRIEND_QUERY_KEYS.all, 'received'] as const,
  sent: () => [...FRIEND_QUERY_KEYS.all, 'sent'] as const,
  friends: () => [...FRIEND_QUERY_KEYS.all, 'friends'] as const,
  search: (query: string) => [...FRIEND_QUERY_KEYS.all, 'search', query] as const,
} as const;
