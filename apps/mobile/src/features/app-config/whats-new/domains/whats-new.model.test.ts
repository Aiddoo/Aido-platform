import type { FeatureCampaignConfig } from '@src/features/app-config/feature-campaign/domains/feature-campaign.model';
import { toInstant } from '@src/shared/date/instant';

import { RELEASE_1_15_0, RELEASES } from '../constants/releases';
import type { Release } from './whats-new.model';
import { WhatsNewPolicy } from './whats-new.model';

const createEnabledConfig = (
  overrides: Partial<Extract<FeatureCampaignConfig, { enabled: true }>> = {},
): Extract<FeatureCampaignConfig, { enabled: true }> => ({
  enabled: true,
  campaignId: RELEASE_1_15_0.campaignId,
  minAppVersion: '1.15.0',
  launchedAt: toInstant('2026-11-10T00:00:00.000Z'),
  autoOpen: true,
  ...overrides,
});

describe('shouldAutoOpen', () => {
  const eligibleContext = {
    config: createEnabledConfig(),
    appVersion: '1.15.0',
    hasSeen: false,
  };

  // 가입 시점은 받지 않는다. 출시 뒤에 가입한 새 계정도 이 조건이면 한 번 본다
  it('켜진 캠페인의 출시를 지원 버전과 같은 앱에서 처음 보면 연다', () => {
    // When
    const result = WhatsNewPolicy.shouldAutoOpen(RELEASE_1_15_0, eligibleContext);

    // Then
    expect(result).toBe(true);
  });

  it.each([
    ['서버 비활성', { config: { enabled: false } as const }],
    ['설정 실패', { config: undefined }],
    [
      '다른 출시의 캠페인',
      { config: createEnabledConfig({ campaignId: 'feature-discovery-2026-08' }) },
    ],
    ['지원 버전보다 낮은 앱', { appVersion: '1.14.9' }],
    ['알 수 없는 앱 버전', { appVersion: undefined }],
    ['이미 본 캠페인', { hasSeen: true }],
    ['자동 열기 비활성', { config: createEnabledConfig({ autoOpen: false }) }],
  ])('%s이면 열지 않는다', (_label, overrides) => {
    // When
    const result = WhatsNewPolicy.shouldAutoOpen(RELEASE_1_15_0, {
      ...eligibleContext,
      ...overrides,
    });

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
  it.each([
    ['앱이 모르는', 'feature-discovery-2026-08'],
    ['목록에만 남긴 지난 출시(친구 초대)가 쓰던', 'feature-discovery-2026-11'],
  ])('%s 캠페인이면 찾지 못해 자동으로 열지 않는다', (_label, campaignId) => {
    // When
    const result = WhatsNewPolicy.findReleaseByCampaign(RELEASES, campaignId);

    // Then
    expect(result).toBeNull();
  });
});

describe('canViewRelease', () => {
  it.each([
    [true, false, false],
    [true, true, true],
    [false, false, true],
  ])(
    '초대 필요 %s, 초대 가능 %s이면 목록에 보이는지 %s다',
    (requiresInvite, isInviteAvailable, expected) => {
      // When
      const result = WhatsNewPolicy.canViewRelease(
        { ...RELEASES[0], requiresInvite },
        { isInviteAvailable },
      );

      // Then
      expect(result).toBe(expected);
    },
  );
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
