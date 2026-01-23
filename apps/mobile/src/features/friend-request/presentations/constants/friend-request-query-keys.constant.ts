export const FRIEND_REQUEST_QUERY_KEYS = {
  all: ['friend-request'] as const,
  received: () => [...FRIEND_REQUEST_QUERY_KEYS.all, 'received'] as const,
  sent: () => [...FRIEND_REQUEST_QUERY_KEYS.all, 'sent'] as const,
} as const;
