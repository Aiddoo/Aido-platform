export const FEATURE_DISCOVERY_CAMPAIGN_ID = 'feature-discovery-2026-11';
/** 1.9.0에 시작한 이전 캠페인. 그때 가입한 사용자의 시작 체크리스트가 이 id로 이어진다 */
export const LEGACY_FEATURE_DISCOVERY_CAMPAIGN_ID = 'feature-discovery-2026-08';

export const FEATURE_DISCOVERY_CARD_IDS = ['friend_invite'] as const;

export type FeatureDiscoveryCardId = (typeof FEATURE_DISCOVERY_CARD_IDS)[number];

export type FeatureDiscoveryRoute = '/friends/invite';

export interface FeatureDiscoveryCard {
  id: FeatureDiscoveryCardId;
  route: FeatureDiscoveryRoute;
  /** 이 카드가 소개하는 기능이 운영 플래그로 꺼질 수 있으면 그 플래그 */
  requires: 'invite' | null;
}

export interface FeatureDiscoveryCampaign {
  id: typeof FEATURE_DISCOVERY_CAMPAIGN_ID;
  cards: readonly FeatureDiscoveryCard[];
}

const FEATURE_DISCOVERY_CAMPAIGN: FeatureDiscoveryCampaign = {
  id: FEATURE_DISCOVERY_CAMPAIGN_ID,
  cards: [{ id: 'friend_invite', route: '/friends/invite', requires: 'invite' }],
};

export function getBundledFeatureDiscoveryCampaign(
  campaignId: string,
): FeatureDiscoveryCampaign | null {
  return campaignId === FEATURE_DISCOVERY_CAMPAIGN_ID ? FEATURE_DISCOVERY_CAMPAIGN : null;
}

/** 꺼진 기능의 카드를 걸러 낸다. 남는 카드가 없으면 소개할 것이 없어 null이다 */
export function filterAvailableCampaign(
  campaign: FeatureDiscoveryCampaign | null,
  { isInviteAvailable }: { isInviteAvailable: boolean },
): FeatureDiscoveryCampaign | null {
  if (campaign == null) {
    return null;
  }

  const cards = campaign.cards.filter((card) => card.requires !== 'invite' || isInviteAvailable);
  return cards.length === 0 ? null : { ...campaign, cards };
}
