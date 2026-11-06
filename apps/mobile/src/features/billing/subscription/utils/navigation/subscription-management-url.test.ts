import { createSubscriptionManagementUrl } from './subscription-management-url';

describe('createSubscriptionManagementUrl', () => {
  test.each([
    [
      'android',
      { productId: 'premium_monthly', applicationId: 'com.aido.mobile' },
      'https://play.google.com/store/account/subscriptions?sku=premium_monthly&package=com.aido.mobile',
    ],
    [
      'android',
      { productId: null, applicationId: 'com.aido.mobile' },
      'https://play.google.com/store/account/subscriptions',
    ],
    [
      'android',
      { productId: 'premium_monthly', applicationId: null },
      'https://play.google.com/store/account/subscriptions',
    ],
    [
      'ios',
      { productId: 'premium_monthly', applicationId: 'com.aido.mobile' },
      'https://apps.apple.com/account/subscriptions',
    ],
    ['web', { productId: null, applicationId: null }, null],
  ] as const)('%s %o → %s', (platform, target, url) => {
    expect(createSubscriptionManagementUrl(platform, target)).toBe(url);
  });
});
