export const ENTITLEMENT_QUERY_KEYS = {
  all: ['entitlements'] as const,
  snapshot: () => [...ENTITLEMENT_QUERY_KEYS.all] as const,
} as const;
