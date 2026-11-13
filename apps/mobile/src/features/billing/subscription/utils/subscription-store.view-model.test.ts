import { findSubscriptionStore } from './subscription-store.view-model';

describe('findSubscriptionStore', () => {
  it.each([
    ['ios', 'appStore'],
    ['macos', 'appStore'],
    ['android', 'googlePlay'],
  ] as const)('%s는 %s에서 구독을 관리한다', (os, expected) => {
    // Given
    const platform = os;

    // When
    const store = findSubscriptionStore(platform);

    // Then
    expect(store).toBe(expected);
  });

  it('인앱 구독이 없는 웹은 스토어가 없다', () => {
    // Given
    const platform = 'web';

    // When
    const store = findSubscriptionStore(platform);

    // Then
    expect(store).toBeNull();
  });
});
