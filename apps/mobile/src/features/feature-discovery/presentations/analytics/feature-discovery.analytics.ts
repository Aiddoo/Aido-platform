import type { Analytics } from '@src/core/ports/analytics';
import type { FeatureHubSource, FeatureKey } from '@src/shared/analytics/events/growth.events';
import type { FeatureAttributionStore } from '@src/shared/analytics/feature-attribution';
import { track } from '@src/shared/analytics/track';
import type { FeatureDiscoveryCardId } from '../../models/feature-discovery.registry';

const CARD_FEATURE_KEYS = {
  memo_ai: 'memo_ai',
  friend_search: 'friend_search',
  drag_reorder: 'category_reorder',
  todo_creation: 'todo_creation',
} as const satisfies Record<FeatureDiscoveryCardId, FeatureKey>;

interface FeatureDiscoveryHubEventInput {
  campaignId: string;
  source: FeatureHubSource;
}

interface FeatureDiscoveryCardCtaInput extends FeatureDiscoveryHubEventInput {
  accountId: string | undefined;
  cardId: FeatureDiscoveryCardId;
}

export function recordFeatureDiscoveryImpression(
  analytics: Analytics,
  { campaignId, source }: FeatureDiscoveryHubEventInput,
): void {
  track(analytics, 'feature_hub_impression', {
    campaign_id: campaignId,
    source,
  });
}

export function recordFeatureDiscoveryDismissed(
  analytics: Analytics,
  { campaignId, source }: FeatureDiscoveryHubEventInput,
): void {
  track(analytics, 'feature_hub_dismissed', {
    campaign_id: campaignId,
    source,
  });
}

export function recordFeatureDiscoveryCardCta(
  analytics: Analytics,
  attribution: FeatureAttributionStore,
  { accountId, campaignId, cardId, source }: FeatureDiscoveryCardCtaInput,
): void {
  const feature = CARD_FEATURE_KEYS[cardId];
  track(analytics, 'feature_card_cta', {
    campaign_id: campaignId,
    feature,
    source,
  });
  if (accountId) {
    attribution.record({ accountId, campaignId, feature });
  }
}
