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

/** 출시 소개 캠페인 id(운영 FEATURE_DISCOVERY_CAMPAIGN_ID). 앱이 묶어 온 출시의 값만 지표에 실린다 */
export type CampaignId = string;
