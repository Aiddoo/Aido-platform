import { createPremiumAccess } from '../__tests__/premium-access.fixtures';
import { toUserAnalyticsProperties } from './user-analytics-properties';

describe('toUserAnalyticsProperties', () => {
  it('스토어 결제 사용자만 premium_source를 store로 남긴다', () => {
    // Given 스토어 결제 / When 사용자 속성을 만들면 / Then 유료 출처가 store다
    expect(
      toUserAnalyticsProperties({
        role: 'USER',
        isPremium: true,
        subscriptionStatus: 'ACTIVE',
        premiumAccess: createPremiumAccess({ source: 'STORE' }),
      }),
    ).toEqual({ is_premium: true, subscription_status: 'ACTIVE', premium_source: 'store' });
  });

  it('초대 보상 기간은 프리미엄이지만 출처를 grant로 남겨 유료 전환에서 뺄 수 있다', () => {
    // Given 보상 기간 중인 무료 구독 상태 / When 사용자 속성을 만들면 / Then grant다
    expect(
      toUserAnalyticsProperties({
        role: 'USER',
        isPremium: true,
        subscriptionStatus: 'FREE',
        premiumAccess: createPremiumAccess({ source: 'GRANT' }),
      }),
    ).toEqual({ is_premium: true, subscription_status: 'FREE', premium_source: 'grant' });
  });

  it('ADMIN은 결제 여부와 무관하게 admin이고 is_premium은 지금처럼 true다', () => {
    // Given 출처 없는 ADMIN / When 사용자 속성을 만들면 / Then admin이다
    expect(
      toUserAnalyticsProperties({
        role: 'ADMIN',
        isPremium: false,
        subscriptionStatus: 'FREE',
        premiumAccess: createPremiumAccess({ source: null }),
      }),
    ).toEqual({ is_premium: true, subscription_status: 'FREE', premium_source: 'admin' });
  });

  it('프리미엄 출처가 없는 일반 사용자는 none이다', () => {
    // Given 무료 사용자 / When 사용자 속성을 만들면 / Then none이고 프리미엄이 아니다
    expect(
      toUserAnalyticsProperties({
        role: 'USER',
        isPremium: false,
        subscriptionStatus: 'EXPIRED',
        premiumAccess: createPremiumAccess({ source: null }),
      }),
    ).toEqual({ is_premium: false, subscription_status: 'EXPIRED', premium_source: 'none' });
  });
});
