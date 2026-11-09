export const FEATURE_KEYS = [
  'memo_ai',
  'friend_search',
  'todo_reorder',
  'category_reorder',
  'todo_creation',
  'friend_invite',
  'voice_quick',
  'voice_note',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];
