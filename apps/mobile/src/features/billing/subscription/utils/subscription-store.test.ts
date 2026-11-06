import { getSubscriptionStore } from './subscription-store';

describe('getSubscriptionStore', () => {
  test.each([
    ['ios', 'appStore'],
    ['macos', 'appStore'],
    ['android', 'googlePlay'],
  ] as const)('%s는 %s에서 구독을 관리한다', (os, expected) => {
    // Given
    const platform = os;

    // When
    const store = getSubscriptionStore(platform);

    // Then
    expect(store).toBe(expected);
  });

  test('인앱 구독이 없는 웹은 스토어가 없다', () => {
    // Given
    const platform = 'web';

    // When
    const store = getSubscriptionStore(platform);

    // Then
    expect(store).toBeNull();
  });
});
