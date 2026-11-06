import type { User } from '@src/features/identity/user/schemas/user.schema';
import { toInstant } from '@src/shared/date/instant';
import { i18n } from '@src/shared/i18n';

import { RELEASES } from '../constants/releases';
import type { ReleaseList } from '../schemas/release.schema';
import type { WhatsNewConfig } from '../schemas/whats-new.schema';
import { WhatsNewPolicy, isSemanticVersionAtLeast } from './whats-new.model';

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
  premiumAccess: {
    source: null,
    endsAt: null,
    periodEndsAt: null,
    willRenew: false,
    bankedDays: 0,
    grantEndedAt: null,
  },
  isPremium: false,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  ...overrides,
});

const createEnabledConfig = (
  overrides: Partial<Extract<WhatsNewConfig, { enabled: true }>> = {},
): Extract<WhatsNewConfig, { enabled: true }> => ({
  enabled: true,
  campaignId: 'feature-discovery-2026-08',
  minAppVersion: '1.8.0',
  launchedAt: toInstant('2026-08-01T00:00:00.000Z'),
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

describe('WhatsNewPolicy.canAutoOpen', () => {
  const eligibleInput = {
    config: createEnabledConfig(),
    user: createUser(),
    appVersion: '1.8.0',
    hasSeen: false,
  };

  it('출시 전 가입한 사용자가 지원 버전에서 처음 보면 true를 반환한다', () => {
    // When
    const result = WhatsNewPolicy.canAutoOpen(eligibleInput);

    // Then
    expect(result).toBe(true);
  });

  it.each([
    [{ config: { enabled: false } as const }, '서버 비활성'],
    [{ config: undefined }, '설정 실패'],
    [{ user: undefined }, '사용자 조회 실패'],
    [{ user: createUser({ createdAt: new Date('2026-08-01T00:00:00.000Z') }) }, '신규 사용자'],
    [{ appVersion: '1.7.9' }, '미지원 앱'],
    [{ appVersion: undefined }, '알 수 없는 앱 버전'],
    [{ hasSeen: true }, '이미 본 캠페인'],
    [{ config: createEnabledConfig({ autoOpen: false }) }, '자동 열기 비활성'],
  ])('%s 조건에서는 false를 반환한다', (overrides, _label) => {
    // When
    const result = WhatsNewPolicy.canAutoOpen({ ...eligibleInput, ...overrides });

    // Then
    expect(result).toBe(false);
  });
});

describe('WhatsNewPolicy.getLatestRelease', () => {
  it('목록 순서와 상관없이 가장 최근에 나온 출시를 고른다', () => {
    // Given
    const releases: ReleaseList = [
      { ...RELEASES[0], releasedOn: '2026-10-01' },
      { ...RELEASES[0], releasedOn: '2026-11-01' },
    ];

    // When
    const result = WhatsNewPolicy.getLatestRelease(releases);

    // Then
    expect(result.releasedOn).toBe('2026-11-01');
  });
});

describe('WhatsNewPolicy.findReleaseByCampaign', () => {
  it('앱이 모르는 캠페인이면 찾지 못한다', () => {
    // When
    const result = WhatsNewPolicy.findReleaseByCampaign(RELEASES, 'feature-discovery-2026-08');

    // Then
    expect(result).toBeUndefined();
  });
});

describe('WhatsNewPolicy.isReleaseAvailable', () => {
  it.each([
    [true, false, false],
    [true, true, true],
    [false, false, true],
  ])('초대 필요 %s, 초대 가능 %s이면 %s다', (requiresInvite, isInviteAvailable, expected) => {
    // When
    const result = WhatsNewPolicy.isReleaseAvailable({ requiresInvite }, { isInviteAvailable });

    // Then
    expect(result).toBe(expected);
  });
});

describe('WhatsNewPolicy.isReentryVisible', () => {
  const openedAt = toInstant('2026-11-01T00:00:00.000Z');

  it.each([
    ['2026-11-01T00:00:00.000Z', true],
    ['2026-11-14T23:59:59.000Z', true],
    ['2026-11-15T00:00:00.000Z', false],
    ['2026-10-31T23:59:59.000Z', false],
  ])('%s에는 %s다', (now, expected) => {
    // When
    const result = WhatsNewPolicy.isReentryVisible(openedAt, toInstant(now));

    // Then
    expect(result).toBe(expected);
  });

  it('처음 본 기록이 없으면 보이지 않는다', () => {
    // When
    const result = WhatsNewPolicy.isReentryVisible(null, openedAt);

    // Then
    expect(result).toBe(false);
  });
});

describe('WhatsNewPolicy.hasUnseenRelease', () => {
  it('최신 출시를 봤으면 지난 출시를 안 봤어도 없다', () => {
    // When
    const result = WhatsNewPolicy.hasUnseenRelease(RELEASES, [RELEASES[0].campaignId]);

    // Then
    expect(result).toBe(false);
  });

  it('최신 출시를 안 봤으면 있다', () => {
    // When
    const result = WhatsNewPolicy.hasUnseenRelease(RELEASES, []);

    // Then
    expect(result).toBe(true);
  });
});

describe('RELEASES', () => {
  it('출시 id와 캠페인 id가 겹치지 않고 요약 문구가 있다', () => {
    // Then
    expect(new Set(RELEASES.map((release) => release.id)).size).toBe(RELEASES.length);
    expect(new Set(RELEASES.map((release) => release.campaignId)).size).toBe(RELEASES.length);
    RELEASES.forEach((release) => {
      expect(i18n.exists(release.summaryKey, { ns: 'whatsNew' })).toBe(true);
    });
  });
});
