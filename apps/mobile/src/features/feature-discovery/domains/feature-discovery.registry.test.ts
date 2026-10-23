import {
  FEATURE_DISCOVERY_CAMPAIGN_ID,
  getBundledFeatureDiscoveryCampaign,
} from './feature-discovery.registry';

describe('getBundledFeatureDiscoveryCampaign', () => {
  it('2026-08 캠페인의 네 가지 기능 카드를 순서대로 반환한다', () => {
    // When
    const campaign = getBundledFeatureDiscoveryCampaign(FEATURE_DISCOVERY_CAMPAIGN_ID);

    // Then
    expect(campaign?.cards.map((card) => card.id)).toEqual([
      'memo_ai',
      'friend_search',
      'drag_reorder',
      'todo_creation',
    ]);
  });

  it('알 수 없는 캠페인은 null을 반환한다', () => {
    // When
    const campaign = getBundledFeatureDiscoveryCampaign('unknown-campaign');

    // Then
    expect(campaign).toBeNull();
  });
});
