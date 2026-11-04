import {
  FEATURE_DISCOVERY_CAMPAIGN_ID,
  PREVIOUS_FEATURE_DISCOVERY_CAMPAIGN_ID,
  filterAvailableCampaign,
  getBundledFeatureDiscoveryCampaign,
} from './feature-discovery.registry';

describe('getBundledFeatureDiscoveryCampaign', () => {
  it('2026-12 캠페인은 말로 할 일 만들기 카드 3장에 친구 초대 카드를 이어 반환한다', () => {
    // When
    const campaign = getBundledFeatureDiscoveryCampaign(FEATURE_DISCOVERY_CAMPAIGN_ID);

    // Then
    expect(campaign?.cards.map((card) => card.id)).toEqual([
      'voice_say',
      'voice_plan',
      'voice_facts',
      'friend_invite',
    ]);
  });

  it('서버가 아직 가리키는 이전 2026-11 캠페인은 친구 초대 카드만 반환한다', () => {
    // When
    const campaign = getBundledFeatureDiscoveryCampaign(PREVIOUS_FEATURE_DISCOVERY_CAMPAIGN_ID);

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
    expect(result?.cards.map((card) => card.id)).toContain('friend_invite');
  });

  it('초대 기능이 꺼지면 친구 초대 카드만 빠지고 말로 할 일 만들기 카드는 남는다', () => {
    // Given
    const campaign = getBundledFeatureDiscoveryCampaign(FEATURE_DISCOVERY_CAMPAIGN_ID);

    // When
    const result = filterAvailableCampaign(campaign, { isInviteAvailable: false });

    // Then
    expect(result?.cards.map((card) => card.id)).toEqual([
      'voice_say',
      'voice_plan',
      'voice_facts',
    ]);
  });

  it('초대 기능이 꺼져 남는 카드가 없으면 null을 반환한다', () => {
    // Given
    const campaign = getBundledFeatureDiscoveryCampaign(PREVIOUS_FEATURE_DISCOVERY_CAMPAIGN_ID);

    // When
    const result = filterAvailableCampaign(campaign, { isInviteAvailable: false });

    // Then
    expect(result).toBeNull();
  });
});
