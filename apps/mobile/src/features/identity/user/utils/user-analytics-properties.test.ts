import { createPremiumAccess } from '../__tests__/premium-access.fixtures';
import { createUser } from '../__tests__/user.fixtures';
import { toUserAnalyticsProperties } from './user-analytics-properties';

describe('toUserAnalyticsProperties', () => {
  it('스토어 결제 사용자만 premium_source를 store로 남긴다', () => {
    // Given
    const user = createUser({
      role: 'USER',
      isPremium: true,
      subscriptionStatus: 'ACTIVE',
      premiumAccess: createPremiumAccess({ source: 'STORE' }),
    });

    // When
    const properties = toUserAnalyticsProperties(user);

    // Then
    expect(properties).toEqual({
      is_premium: true,
      subscription_status: 'ACTIVE',
      premium_source: 'store',
    });
  });

  it('초대 보상 기간은 프리미엄이지만 출처를 grant로 남겨 유료 전환에서 뺄 수 있다', () => {
    // Given
    const user = createUser({
      role: 'USER',
      isPremium: true,
      subscriptionStatus: 'FREE',
      premiumAccess: createPremiumAccess({ source: 'GRANT' }),
    });

    // When
    const properties = toUserAnalyticsProperties(user);

    // Then
    expect(properties).toEqual({
      is_premium: true,
      subscription_status: 'FREE',
      premium_source: 'grant',
    });
  });

  it('ADMIN은 결제 여부와 무관하게 admin이고 is_premium은 지금처럼 true다', () => {
    // Given
    const user = createUser({
      role: 'ADMIN',
      isPremium: false,
      subscriptionStatus: 'FREE',
      premiumAccess: createPremiumAccess({ source: null }),
    });

    // When
    const properties = toUserAnalyticsProperties(user);

    // Then
    expect(properties).toEqual({
      is_premium: true,
      subscription_status: 'FREE',
      premium_source: 'admin',
    });
  });

  it('프리미엄 출처가 없는 일반 사용자는 none이다', () => {
    // Given
    const user = createUser({
      role: 'USER',
      isPremium: false,
      subscriptionStatus: 'EXPIRED',
      premiumAccess: createPremiumAccess({ source: null }),
    });

    // When
    const properties = toUserAnalyticsProperties(user);

    // Then
    expect(properties).toEqual({
      is_premium: false,
      subscription_status: 'EXPIRED',
      premium_source: 'none',
    });
  });
});
