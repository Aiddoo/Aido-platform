import type { User } from '@src/features/user/models/user.model';

import {
  type FeatureDiscoveryConfig,
  FeatureDiscoveryPolicy,
  isSemanticVersionAtLeast,
} from './feature-discovery.model';

const createUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  email: 'user@example.com',
  name: '사용자',
  profileImage: null,
  userTag: 'MATT2025',
  role: 'USER',
  subscriptionStatus: 'FREE',
  subscriptionExpiresAt: null,
  providers: ['GOOGLE'],
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  ...overrides,
});

const createEnabledConfig = (
  overrides: Partial<Extract<FeatureDiscoveryConfig, { enabled: true }>> = {},
): Extract<FeatureDiscoveryConfig, { enabled: true }> => ({
  enabled: true,
  campaignId: 'feature-discovery-2026-08',
  minAppVersion: '1.8.0',
  launchedAt: new Date('2026-08-01T00:00:00.000Z'),
  autoOpen: true,
  ...overrides,
});

describe('isSemanticVersionAtLeast', () => {
  it.each([
    ['1.8.0', '1.8.0'],
    ['1.8.1', '1.8.0'],
    ['2.0.0', '1.8.0'],
    ['1.8.0', '1.8.0-rc.1'],
  ])('%s는 최소 버전 %s를 충족한다', (appVersion, minVersion) => {
    // When
    const result = isSemanticVersionAtLeast(appVersion, minVersion);

    // Then
    expect(result).toBe(true);
  });

  it.each([
    ['1.7.9', '1.8.0'],
    ['1.8.0-rc.1', '1.8.0'],
    ['1.8.0-alpha-a', '1.8.0-alpha-b'],
    ['1.8.0-A', '1.8.0-a'],
    [undefined, '1.8.0'],
    ['invalid', '1.8.0'],
  ])('%s는 최소 버전 %s를 충족하지 않는다', (appVersion, minVersion) => {
    // When
    const result = isSemanticVersionAtLeast(appVersion, minVersion);

    // Then
    expect(result).toBe(false);
  });
});

describe('FeatureDiscoveryPolicy.canAutoOpen', () => {
  const eligibleInput = {
    authStatus: 'authenticated' as const,
    config: createEnabledConfig(),
    user: createUser(),
    appVersion: '1.8.0',
    hasBundledCampaign: true,
    hasSeen: false,
  };

  it('출시 전 가입한 인증 사용자가 지원 버전에서 처음 보면 true를 반환한다', () => {
    // When
    const result = FeatureDiscoveryPolicy.canAutoOpen(eligibleInput);

    // Then
    expect(result).toBe(true);
  });

  it.each([
    [{ authStatus: 'unauthenticated' as const }, '미인증'],
    [{ config: { enabled: false } as const }, '서버 비활성'],
    [{ config: undefined }, '설정 실패'],
    [{ user: undefined }, '사용자 조회 실패'],
    [{ user: createUser({ createdAt: new Date('2026-08-01T00:00:00.000Z') }) }, '신규 사용자'],
    [{ appVersion: '1.7.9' }, '미지원 앱'],
    [{ appVersion: undefined }, '알 수 없는 앱 버전'],
    [{ hasBundledCampaign: false }, '알 수 없는 캠페인'],
    [{ hasSeen: true }, '이미 본 캠페인'],
    [{ config: createEnabledConfig({ autoOpen: false }) }, '자동 열기 비활성'],
  ])('%s 조건에서는 false를 반환한다', (overrides, _label) => {
    // When
    const result = FeatureDiscoveryPolicy.canAutoOpen({ ...eligibleInput, ...overrides });

    // Then
    expect(result).toBe(false);
  });
});
