export const FEATURE_DISCOVERY_CAMPAIGN_ID = 'feature-discovery-2026-08';
export const FEATURE_DISCOVERY_CAMPAIGN_LAUNCHED_AT = '2026-08-01T00:00:00.000Z';

export const FEATURE_DISCOVERY_CARD_IDS = [
  'memo_ai',
  'friend_search',
  'drag_reorder',
  'todo_creation',
] as const;

export type FeatureDiscoveryCardId = (typeof FEATURE_DISCOVERY_CARD_IDS)[number];

export type FeatureDiscoveryRoute =
  | '/memo/create'
  | '/friends/search'
  | '/settings/category-settings'
  | '/feed';

export interface FeatureDiscoveryCard {
  id: FeatureDiscoveryCardId;
  route: FeatureDiscoveryRoute;
}

export interface FeatureDiscoveryCampaign {
  id: typeof FEATURE_DISCOVERY_CAMPAIGN_ID;
  cards: readonly FeatureDiscoveryCard[];
}

const FEATURE_DISCOVERY_CAMPAIGN: FeatureDiscoveryCampaign = {
  id: FEATURE_DISCOVERY_CAMPAIGN_ID,
  cards: [
    { id: 'memo_ai', route: '/memo/create' },
    { id: 'friend_search', route: '/friends/search' },
    { id: 'drag_reorder', route: '/settings/category-settings' },
    { id: 'todo_creation', route: '/feed' },
  ],
};

export function getBundledFeatureDiscoveryCampaign(
  campaignId: string,
): FeatureDiscoveryCampaign | null {
  return campaignId === FEATURE_DISCOVERY_CAMPAIGN_ID ? FEATURE_DISCOVERY_CAMPAIGN : null;
}
