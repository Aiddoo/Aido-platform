import {
  FEATURE_DISCOVERY_CAMPAIGN_ID,
  type FeatureDiscoveryCardId,
  type FeatureDiscoveryRoute,
  getBundledFeatureDiscoveryCampaign,
} from '../../models/feature-discovery.registry';

export interface FeatureDiscoveryNavigator {
  push(route: FeatureDiscoveryRoute): void;
}

export function navigateToFeatureDiscoveryCard(
  navigator: FeatureDiscoveryNavigator,
  cardId: FeatureDiscoveryCardId,
): void {
  const campaign = getBundledFeatureDiscoveryCampaign(FEATURE_DISCOVERY_CAMPAIGN_ID);
  const card = campaign?.cards.find((item) => item.id === cardId);
  if (card) {
    navigator.push(card.route);
  }
}
