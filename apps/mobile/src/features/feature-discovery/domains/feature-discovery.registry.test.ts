import {
  FEATURE_DISCOVERY_CAMPAIGN_ID,
  filterAvailableCampaign,
  getBundledFeatureDiscoveryCampaign,
} from './feature-discovery.registry';

describe('getBundledFeatureDiscoveryCampaign', () => {
  it('2026-11 캠페인의 친구 초대 카드를 반환한다', () => {
    // When
    const campaign = getBundledFeatureDiscoveryCampaign(FEATURE_DISCOVERY_CAMPAIGN_ID);

    // Then
    expect(campaign?.cards.map((card) => card.id)).toEqual(['friend_invite']);
  });

  it('알 수 없는 캠페인은 null을 반환한다', () => {
    // When
    const campaign = getBundledFeatureDiscoveryCampaign('unknown-campaign');

    // Then
    expect(campaign).toBeNull();
  });
});

describe('filterAvailableCampaign', () => {
  it('초대 기능이 켜져 있으면 친구 초대 카드를 남긴 캠페인을 반환한다', () => {
    // Given
    const campaign = getBundledFeatureDiscoveryCampaign(FEATURE_DISCOVERY_CAMPAIGN_ID);

    // When
    const result = filterAvailableCampaign(campaign, { isInviteAvailable: true });

    // Then
    expect(result?.cards.map((card) => card.id)).toEqual(['friend_invite']);
  });

  it('초대 기능이 꺼져 남는 카드가 없으면 null을 반환한다', () => {
    // Given
    const campaign = getBundledFeatureDiscoveryCampaign(FEATURE_DISCOVERY_CAMPAIGN_ID);

    // When
    const result = filterAvailableCampaign(campaign, { isInviteAvailable: false });

    // Then
    expect(result).toBeNull();
  });
});
