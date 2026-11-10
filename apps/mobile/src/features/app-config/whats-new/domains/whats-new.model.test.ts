import type { FeatureCampaignConfig } from '@src/features/app-config/feature-campaign/domains/feature-campaign.model';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { toInstant } from '@src/shared/date/instant';

import { RELEASES } from '../constants/releases';
import type { Release } from './whats-new.model';
import { WhatsNewPolicy } from './whats-new.model';

const createEnabledConfig = (
  overrides: Partial<Extract<FeatureCampaignConfig, { enabled: true }>> = {},
): Extract<FeatureCampaignConfig, { enabled: true }> => ({
  enabled: true,
  campaignId: 'feature-discovery-2026-08',
  minAppVersion: '1.8.0',
  launchedAt: toInstant('2026-08-01T00:00:00.000Z'),
  autoOpen: true,
  ...overrides,
});

describe('shouldAutoOpen', () => {
  const eligibleInput = {
    config: createEnabledConfig(),
    user: createUser({ createdAt: toInstant('2026-07-01T00:00:00.000Z') }),
    appVersion: '1.8.0',
    hasSeen: false,
  };

  it('출시 전 가입한 사용자가 지원 버전에서 처음 보면 true를 반환한다', () => {
    // When
    const result = WhatsNewPolicy.shouldAutoOpen(eligibleInput);

    // Then
    expect(result).toBe(true);
  });

  it.each([
    ['서버 비활성', { config: { enabled: false } as const }],
    ['설정 실패', { config: undefined }],
    ['사용자 조회 실패', { user: undefined }],
    ['신규 사용자', { user: createUser({ createdAt: toInstant('2026-08-01T00:00:00.000Z') }) }],
    ['미지원 앱', { appVersion: '1.7.9' }],
    ['알 수 없는 앱 버전', { appVersion: undefined }],
    ['이미 본 캠페인', { hasSeen: true }],
    ['자동 열기 비활성', { config: createEnabledConfig({ autoOpen: false }) }],
  ])('%s 조건에서는 false를 반환한다', (_label, overrides) => {
    // When
    const result = WhatsNewPolicy.shouldAutoOpen({ ...eligibleInput, ...overrides });

    // Then
    expect(result).toBe(false);
  });
});

describe('getLatestRelease', () => {
  it('목록 순서와 상관없이 가장 최근에 나온 출시를 고른다', () => {
    // Given
    const releases: [Release, ...Release[]] = [
      { ...RELEASES[0], releasedOn: '2026-10-01' },
      { ...RELEASES[0], releasedOn: '2026-11-01' },
    ];

    // When
    const result = WhatsNewPolicy.getLatestRelease(releases);

    // Then
    expect(result.releasedOn).toBe('2026-11-01');
  });
});

describe('findReleaseByCampaign', () => {
  it('앱이 모르는 캠페인이면 찾지 못한다', () => {
    // When
    const result = WhatsNewPolicy.findReleaseByCampaign(RELEASES, 'feature-discovery-2026-08');

    // Then
    expect(result).toBeNull();
  });
});

describe('canViewRelease', () => {
  it.each([
    [true, false, false],
    [true, true, true],
    [false, false, true],
  ])('초대 필요 %s, 초대 가능 %s이면 %s다', (requiresInvite, isInviteAvailable, expected) => {
    // When
    const result = WhatsNewPolicy.canViewRelease(
      { ...RELEASES[0], requiresInvite },
      { isInviteAvailable },
    );

    // Then
    expect(result).toBe(expected);
  });
});

describe('shouldShowReentry', () => {
  const openedAt = toInstant('2026-11-01T00:00:00.000Z');

  it.each([
    ['2026-11-01T00:00:00.000Z', true],
    ['2026-11-14T23:59:59.000Z', true],
    ['2026-11-15T00:00:00.000Z', false],
    ['2026-10-31T23:59:59.000Z', true],
  ])('%s에는 %s다', (now, expected) => {
    // When
    const result = WhatsNewPolicy.shouldShowReentry(openedAt, toInstant(now));

    // Then
    expect(result).toBe(expected);
  });

  it('처음 본 기록이 없으면 보이지 않는다', () => {
    // When
    const result = WhatsNewPolicy.shouldShowReentry(null, openedAt);

    // Then
    expect(result).toBe(false);
  });
});
