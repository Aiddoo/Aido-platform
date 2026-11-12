import { PLAN_CATALOG } from '@aido/api/vocabulary';
import { toInstant } from '@src/shared/date/instant';

import {
  createEntitlementSnapshot,
  createFeatureQuotaDto,
} from '../__tests__/entitlement.fixtures';
import { toFeatureQuota } from '../apis/entitlement.mapper';
import { EntitlementPolicy, getBlockedDecision } from './entitlement.model';

const SEOUL = 'Asia/Seoul';
const LOS_ANGELES = 'America/Los_Angeles';
const NOW = toInstant('2026-11-15T00:00:00.000Z');

describe('hasFullAccess', () => {
  it.each([
    ['FREE', false],
    ['PREMIUM', true],
    ['ADMIN', true],
  ] as const)('%s의 모든 기능 사용 여부는 %s다', (tier, expected) => {
    // Given
    const snapshot = createEntitlementSnapshot({ tier });

    // When
    const hasFullAccess = EntitlementPolicy.hasFullAccess(snapshot);

    // Then
    expect(hasFullAccess).toBe(expected);
  });
});

describe('getAccessDecision', () => {
  it.each([
    ['FREE', 'limit-reached'],
    ['PREMIUM', 'allow'],
    ['ADMIN', 'allow'],
  ] as const)('AI 할 일 만들기를 무료 한도만큼 쓰면 %s는 %s다', (tier, expected) => {
    // Given
    const snapshot = createEntitlementSnapshot({
      tier,
      used: { AI_PARSE: PLAN_CATALOG.AI_PARSE.free },
    });

    // When
    const decision = EntitlementPolicy.getAccessDecision(snapshot, 'AI_PARSE', NOW);

    // Then
    expect(decision).toBe(expected);
  });

  it.each([
    [PLAN_CATALOG.AI_PARSE.free - 1, 'allow'],
    [PLAN_CATALOG.AI_PARSE.free, 'limit-reached'],
  ] as const)('무료 사용자가 AI 할 일 만들기를 %i번 썼으면 %s다', (used, expected) => {
    // Given
    const snapshot = createEntitlementSnapshot({ tier: 'FREE', used: { AI_PARSE: used } });

    // When
    const decision = EntitlementPolicy.getAccessDecision(snapshot, 'AI_PARSE', NOW);

    // Then
    expect(decision).toBe(expected);
  });

  it.each([
    ['FREE', 'locked'],
    ['PREMIUM', 'allow'],
    ['ADMIN', 'allow'],
  ] as const)('앱 아이콘 변경은 %s에게 %s다', (tier, expected) => {
    // Given
    const snapshot = createEntitlementSnapshot({ tier });

    // When
    const decision = EntitlementPolicy.getAccessDecision(snapshot, 'APP_ICON', NOW);

    // Then
    expect(decision).toBe(expected);
  });

  it('프리미엄도 공정 사용 상한을 다 쓰면 한도에 닿는다', () => {
    // Given
    const snapshot = createEntitlementSnapshot({
      tier: 'PREMIUM',
      used: { AI_PARSE: PLAN_CATALOG.AI_PARSE.fairUse.premium },
    });

    // When
    const decision = EntitlementPolicy.getAccessDecision(snapshot, 'AI_PARSE', NOW);

    // Then
    expect(decision).toBe('limit-reached');
  });

  it.each([
    ['지난 초기화 시각', toInstant('2026-11-01T00:00:00.000Z'), 'allow'],
    ['지금과 같은 초기화 시각', NOW, 'allow'],
    ['앞으로의 초기화 시각', toInstant('2026-12-01T00:00:00.000Z'), 'limit-reached'],
    ['초기화 시각 없음', null, 'limit-reached'],
  ] as const)('남은 횟수가 0일 때 %s이면 %s다', (_label, resetsAt, expected) => {
    // Given
    const usedUp = createEntitlementSnapshot({
      used: { AI_PARSE: PLAN_CATALOG.AI_PARSE.free },
    });
    const snapshot = EntitlementPolicy.withFeatureQuota(usedUp, {
      ...toFeatureQuota(createFeatureQuotaDto('AI_PARSE', { used: PLAN_CATALOG.AI_PARSE.free })),
      resetsAt,
    });

    // When
    const decision = EntitlementPolicy.getAccessDecision(snapshot, 'AI_PARSE', NOW);

    // Then
    expect(decision).toBe(expected);
  });

  it('막힌 기능은 초기화 시각이 지나도 locked다', () => {
    // Given
    const snapshot = createEntitlementSnapshot({ tier: 'FREE' });

    // When
    const decision = EntitlementPolicy.getAccessDecision(snapshot, 'APP_ICON', NOW);

    // Then
    expect(decision).toBe('locked');
  });

  it('스냅샷에 없는 기능은 서버가 판단하도록 막지 않는다', () => {
    // Given
    const snapshot = { ...createEntitlementSnapshot(), features: {} };

    // When
    const decision = EntitlementPolicy.getAccessDecision(snapshot, 'AI_PARSE', NOW);

    // Then
    expect(decision).toBe('allow');
  });
});

describe('canUseFeature', () => {
  it.each([
    ['FREE', false],
    ['PREMIUM', true],
    ['ADMIN', true],
  ] as const)(
    '프리미엄 전용 기능은 서버 allowed 기준으로 %s에게 사용 가능 %s다',
    (tier, expected) => {
      // Given
      const snapshot = createEntitlementSnapshot({ tier });

      // When
      const canUse = EntitlementPolicy.canUseFeature(snapshot, 'AI_REPORT');

      // Then
      expect(canUse).toBe(expected);
    },
  );
});

describe('getQuotaStatus', () => {
  it.each([
    ['FREE 7회 남음', 'FREE', 3, { type: 'remaining', count: 7, period: 'month' }],
    ['FREE 다 씀', 'FREE', 10, { type: 'used-up', period: 'month' }],
    ['PREMIUM 공정 사용', 'PREMIUM', 3, { type: 'untracked' }],
    ['ADMIN 무제한', 'ADMIN', undefined, { type: 'untracked' }],
  ] as const)('%s', (_case, tier, used, expected) => {
    // Given
    const snapshot = createEntitlementSnapshot({ tier, used: { AI_PARSE: used } });

    // When
    const status = EntitlementPolicy.getQuotaStatus(snapshot, 'AI_PARSE', NOW);

    // Then
    expect(status).toEqual(expected);
  });

  it('다 쓴 상태라도 초기화 시각이 이미 지났으면 소진으로 보이지 않는다', () => {
    // Given
    const usedUp = createEntitlementSnapshot({ used: { AI_PARSE: PLAN_CATALOG.AI_PARSE.free } });
    const snapshot = EntitlementPolicy.withFeatureQuota(usedUp, {
      ...toFeatureQuota(createFeatureQuotaDto('AI_PARSE', { used: PLAN_CATALOG.AI_PARSE.free })),
      resetsAt: toInstant('2026-11-01T00:00:00.000Z'),
    });

    // When
    const status = EntitlementPolicy.getQuotaStatus(snapshot, 'AI_PARSE', NOW);

    // Then
    expect(status).toEqual({ type: 'untracked' });
  });

  it('하루 횟수를 다 쓰면 오늘 다 쓴 상태다', () => {
    // Given
    const snapshot = createEntitlementSnapshot({ used: { NUDGE: PLAN_CATALOG.NUDGE.free } });

    // When
    const status = EntitlementPolicy.getQuotaStatus(
      snapshot,
      'NUDGE',
      toInstant('2026-11-04T00:00:00.000Z'),
    );

    // Then
    expect(status).toEqual({ type: 'used-up', period: 'day' });
  });

  it('개수 한도(친구)는 횟수를 세지 않아 알약을 그리지 않는다', () => {
    // Given
    const snapshot = createEntitlementSnapshot();

    // When
    const status = EntitlementPolicy.getQuotaStatus(snapshot, 'FRIEND', NOW);

    // Then
    expect(status).toEqual({ type: 'untracked' });
  });
});

describe('getMaxSeconds', () => {
  it.each([
    ['FREE', PLAN_CATALOG.VOICE_NOTE.perUse.maxSeconds.free],
    ['PREMIUM', PLAN_CATALOG.VOICE_NOTE.perUse.maxSeconds.premium],
  ] as const)('%s의 말로 메모하기 한 번 길이는 서버 값이다', (tier, expected) => {
    // Given
    const snapshot = createEntitlementSnapshot({ tier });

    // When
    const maxSeconds = EntitlementPolicy.getMaxSeconds(snapshot, 'VOICE_NOTE');

    // Then
    expect(maxSeconds).toBe(expected);
  });
});

describe('getResetNotice', () => {
  it('하루 횟수는 다음 자정이 내일이라 내일 다시 쓸 수 있다', () => {
    // Given
    const snapshot = createEntitlementSnapshot();
    const now = toInstant('2026-11-05T14:00:00Z');

    // When
    const notice = EntitlementPolicy.getResetNotice(snapshot, 'NUDGE', { now, timeZone: SEOUL });

    // Then
    expect(notice).toEqual({ type: 'tomorrow' });
  });

  it('한 달 횟수는 초기화 날짜를 알린다', () => {
    // Given
    const snapshot = createEntitlementSnapshot();
    const now = toInstant('2026-11-10T03:00:00Z');

    // When
    const notice = EntitlementPolicy.getResetNotice(snapshot, 'AI_PARSE', { now, timeZone: SEOUL });

    // Then
    expect(notice).toEqual({ type: 'date', date: toInstant('2026-11-30T15:00:00.000Z') });
  });

  it('KST 기준 월초 초기화가 다른 시간대에서 오늘 안이면 오늘이다', () => {
    // Given
    const snapshot = createEntitlementSnapshot();
    const now = toInstant('2026-11-30T09:00:00Z');

    // When
    const notice = EntitlementPolicy.getResetNotice(snapshot, 'AI_PARSE', {
      now,
      timeZone: LOS_ANGELES,
    });

    // Then
    expect(notice).toEqual({ type: 'today' });
  });

  it.each([
    ['ADMIN 무제한', createEntitlementSnapshot({ tier: 'ADMIN' }), 'AI_PARSE'],
    ['횟수를 세지 않는 기능', createEntitlementSnapshot(), 'FRIEND'],
    ['지난 초기화 시각', createEntitlementSnapshot(), 'NUDGE'],
  ] as const)('%s이면 안내하지 않는다', (_case, snapshot, feature) => {
    // Given
    const now = toInstant('2026-12-02T00:00:00Z');

    // When
    const notice = EntitlementPolicy.getResetNotice(snapshot, feature, { now, timeZone: SEOUL });

    // Then
    expect(notice).toBeNull();
  });
});

describe('getLimit', () => {
  it('횟수 기능은 서버가 준 한도를 반환한다', () => {
    // Given
    const snapshot = createEntitlementSnapshot();

    // When
    const limit = EntitlementPolicy.getLimit(snapshot, 'FRIEND');

    // Then
    expect(limit).toBe(PLAN_CATALOG.FRIEND.free);
  });

  it('관리자처럼 한도가 없으면 null을 반환한다', () => {
    // Given
    const snapshot = createEntitlementSnapshot({ tier: 'ADMIN' });

    // When
    const limit = EntitlementPolicy.getLimit(snapshot, 'FRIEND');

    // Then
    expect(limit).toBeNull();
  });

  it('스냅샷에 없는 기능이면 null을 반환한다', () => {
    // Given
    const snapshot = { ...createEntitlementSnapshot(), features: {} };

    // When
    const limit = EntitlementPolicy.getLimit(snapshot, 'FRIEND');

    // Then
    expect(limit).toBeNull();
  });
});

describe('getFreeLimit', () => {
  it('무료 사용자는 초대로 늘어난 자리를 반영한 서버 한도를 쓴다', () => {
    // Given
    const snapshot = EntitlementPolicy.withFeatureQuota(
      createEntitlementSnapshot(),
      toFeatureQuota({ ...createFeatureQuotaDto('FRIEND'), limit: 7 }),
    );

    // When
    const limit = EntitlementPolicy.getFreeLimit(snapshot, 'FRIEND');

    // Then
    expect(limit).toBe(7);
  });

  it.each(['PREMIUM', 'ADMIN'] as const)('%s는 카탈로그의 무료 한도를 쓴다', (tier) => {
    // Given
    const snapshot = createEntitlementSnapshot({ tier });

    // When
    const limit = EntitlementPolicy.getFreeLimit(snapshot, 'FRIEND');

    // Then
    expect(limit).toBe(PLAN_CATALOG.FRIEND.free);
  });
});

describe('withFeatureQuota', () => {
  it('AI 응답이 준 한도로 그 기능만 바꾼다', () => {
    // Given
    const snapshot = createEntitlementSnapshot();
    const quota = toFeatureQuota(createFeatureQuotaDto('AI_PARSE', { used: 4 }));

    // When
    const next = EntitlementPolicy.withFeatureQuota(snapshot, quota);

    // Then
    expect(EntitlementPolicy.getRemainingCount(next, 'AI_PARSE')).toBe(6);
    expect(next.features.NUDGE).toBe(snapshot.features.NUDGE);
  });
});

describe('getBlockedDecision', () => {
  it.each([
    ['서버가 한도를 열어 두고 줬으면', 'AI_PARSE', true, 'limit-reached'],
    ['서버가 등급에서 닫았다고 줬으면', 'AI_PARSE', false, 'locked'],
    ['한도 정보가 없는 횟수 기능이면', 'AI_PARSE', null, 'limit-reached'],
    ['한도 정보가 없는 켜고 끄는 기능이면', 'APP_ICON', null, 'locked'],
  ] as const)('%s %s는 %s다', (_label, feature, allowed, expected) => {
    // Given
    const featureQuota =
      allowed == null ? null : { ...toFeatureQuota(createFeatureQuotaDto(feature)), allowed };
    const limited = { feature, featureQuota };

    // When
    const decision = getBlockedDecision(limited);

    // Then
    expect(decision).toBe(expected);
  });
});

describe('shouldOfferPremium', () => {
  it.each([
    ['스냅샷을 모르면', undefined, true],
    ['무료면', createEntitlementSnapshot({ tier: 'FREE' }), true],
    ['프리미엄이면', createEntitlementSnapshot({ tier: 'PREMIUM' }), false],
    ['관리자면', createEntitlementSnapshot({ tier: 'ADMIN' }), false],
  ] as const)('%s 구독을 권하는 것은 %s다', (_label, snapshot, expected) => {
    // When
    const shouldOffer = EntitlementPolicy.shouldOfferPremium(snapshot);

    // Then
    expect(shouldOffer).toBe(expected);
  });
});
