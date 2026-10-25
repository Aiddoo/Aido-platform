import { navigateToFeatureDiscoveryCard } from './feature-discovery.navigation';

describe('navigateToFeatureDiscoveryCard', () => {
  it.each([['friend_invite', '/friends/invite']] as const)(
    '%s CTA를 앱 내부의 %s 경로로 이동시킨다',
    (cardId, expectedRoute) => {
      // Given
      const navigator = { push: jest.fn() };

      // When
      navigateToFeatureDiscoveryCard(navigator, cardId);

      // Then
      expect(navigator.push).toHaveBeenCalledWith(expectedRoute);
    },
  );
});
