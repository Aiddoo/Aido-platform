import { navigateToFeatureDiscoveryCard } from './feature-discovery.navigation';

describe('navigateToFeatureDiscoveryCard', () => {
  it.each([
    ['memo_ai', '/memo/create'],
    ['friend_search', '/friends/search'],
    ['drag_reorder', '/settings/category-settings'],
    ['todo_creation', '/feed'],
  ] as const)('%s CTA를 앱 내부의 %s 경로로 이동시킨다', (cardId, expectedRoute) => {
    // Given
    const navigator = { push: jest.fn() };

    // When
    navigateToFeatureDiscoveryCard(navigator, cardId);

    // Then
    expect(navigator.push).toHaveBeenCalledWith(expectedRoute);
  });
});
