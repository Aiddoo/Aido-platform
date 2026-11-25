import { createManagementUrl, findSubscriptionStore } from './subscription-store.view-model';

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

describe('createManagementUrl', () => {
  it.each([
    [
      'Android에서 상품 id와 패키지를 알면 그 구독 페이지',
      'android',
      { productId: 'premium_monthly', applicationId: 'com.aido.mobile' },
      'https://play.google.com/store/account/subscriptions?sku=premium_monthly&package=com.aido.mobile',
    ],
    [
      'Android에서 상품 id를 모르면 구독 목록',
      'android',
      { productId: null, applicationId: 'com.aido.mobile' },
      'https://play.google.com/store/account/subscriptions',
    ],
    [
      'Android에서 패키지를 모르면 구독 목록',
      'android',
      { productId: 'premium_monthly', applicationId: null },
      'https://play.google.com/store/account/subscriptions',
    ],
    [
      'iOS는 상품과 상관없이 App Store 구독 관리',
      'ios',
      { productId: 'premium_monthly', applicationId: 'com.aido.mobile' },
      'https://apps.apple.com/account/subscriptions',
    ],
    ['스토어가 없는 플랫폼은 주소 없음', 'web', { productId: null, applicationId: null }, null],
  ] as const)('%s', (_case, platform, target, expected) => {
    // When
    const url = createManagementUrl(platform, target);

    // Then
    expect(url).toBe(expected);
  });
});
