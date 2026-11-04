import { PLAN_CATALOG } from '@aido/api/vocabulary';

import {
  createEntitlementSnapshot,
  createFeatureQuotaDto,
} from '../__tests__/entitlement.factories';
import { toFeatureQuota } from '../apis/entitlement.mapper';
import { EntitlementPolicy } from './entitlement.model';

const SEOUL = 'Asia/Seoul';
const LOS_ANGELES = 'America/Los_Angeles';

describe('EntitlementPolicy', () => {
  describe('등급별 판단', () => {
    it.each([
      ['FREE', false, false],
      ['PREMIUM', true, true],
      ['ADMIN', false, true],
    ] as const)(
      '%s는 유료 효력 %s, 모든 기능 %s',
      (tier, expectedIsPremium, expectedHasFullAccess) => {
        // Given
        const snapshot = createEntitlementSnapshot({ tier });

        // When
        const result = {
          isPremium: EntitlementPolicy.isPremium(snapshot),
          hasFullAccess: EntitlementPolicy.hasFullAccess(snapshot),
        };

        // Then
        expect(result).toEqual({
          isPremium: expectedIsPremium,
          hasFullAccess: expectedHasFullAccess,
        });
      },
    );

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
      const decision = EntitlementPolicy.getAccessDecision(snapshot, 'AI_PARSE');

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
      const decision = EntitlementPolicy.getAccessDecision(snapshot, 'APP_ICON');

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
      const decision = EntitlementPolicy.getAccessDecision(snapshot, 'AI_PARSE');

      // Then
      expect(decision).toBe('limit-reached');
    });

    it('스냅샷에 없는 기능은 서버가 판단하도록 막지 않는다', () => {
      // Given
      const snapshot = { ...createEntitlementSnapshot(), features: {} };

      // When
      const decision = EntitlementPolicy.getAccessDecision(snapshot, 'AI_PARSE');

      // Then
      expect(decision).toBe('allow');
    });
  });

  describe('getQuotaStatus', () => {
    it.each([
      ['FREE 7번 남음', 'FREE', 3, { type: 'remaining', count: 7, period: 'month' }],
      ['FREE 다 씀', 'FREE', 10, { type: 'used-up', period: 'month' }],
      ['PREMIUM 공정 사용', 'PREMIUM', 3, { type: 'hidden' }],
      ['ADMIN 무제한', 'ADMIN', undefined, { type: 'hidden' }],
    ] as const)('%s', (_case, tier, used, expected) => {
      // Given
      const snapshot = createEntitlementSnapshot({ tier, used: { AI_PARSE: used } });

      // When
      const status = EntitlementPolicy.getQuotaStatus(snapshot, 'AI_PARSE');

      // Then
      expect(status).toEqual(expected);
    });

    it('하루 횟수를 다 쓰면 오늘 다 쓴 상태다', () => {
      // Given
      const snapshot = createEntitlementSnapshot({ used: { NUDGE: PLAN_CATALOG.NUDGE.free } });

      // When
      const status = EntitlementPolicy.getQuotaStatus(snapshot, 'NUDGE');

      // Then
      expect(status).toEqual({ type: 'used-up', period: 'day' });
    });

    it('개수 한도(친구)는 횟수를 세지 않아 알약을 그리지 않는다', () => {
      // Given
      const snapshot = createEntitlementSnapshot();

      // When
      const status = EntitlementPolicy.getQuotaStatus(snapshot, 'FRIEND');

      // Then
      expect(status).toEqual({ type: 'hidden' });
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

      // When
      const notice = EntitlementPolicy.getResetNotice(
        snapshot,
        'NUDGE',
        new Date('2026-11-05T14:00:00Z'),
        SEOUL,
      );

      // Then
      expect(notice).toEqual({ type: 'tomorrow' });
    });

    it('한 달 횟수는 초기화 날짜를 알린다', () => {
      // Given
      const snapshot = createEntitlementSnapshot();

      // When
      const notice = EntitlementPolicy.getResetNotice(
        snapshot,
        'AI_PARSE',
        new Date('2026-11-10T03:00:00Z'),
        SEOUL,
      );

      // Then
      expect(notice).toEqual({ type: 'date', date: new Date('2026-11-30T15:00:00.000Z') });
    });

    it('KST 기준 월초 초기화가 다른 시간대에서 오늘 안이면 오늘이다', () => {
      // Given
      const snapshot = createEntitlementSnapshot();

      // When
      const notice = EntitlementPolicy.getResetNotice(
        snapshot,
        'AI_PARSE',
        new Date('2026-11-30T09:00:00Z'),
        LOS_ANGELES,
      );

      // Then
      expect(notice).toEqual({ type: 'today' });
    });

    it.each([
      ['ADMIN 무제한', createEntitlementSnapshot({ tier: 'ADMIN' }), 'AI_PARSE'],
      ['횟수를 세지 않는 기능', createEntitlementSnapshot(), 'FRIEND'],
      ['지난 초기화 시각', createEntitlementSnapshot(), 'NUDGE'],
    ] as const)('%s이면 안내하지 않는다', (_case, snapshot, feature) => {
      // Given
      const now = new Date('2026-12-02T00:00:00Z');

      // When
      const notice = EntitlementPolicy.getResetNotice(snapshot, feature, now, SEOUL);

      // Then
      expect(notice).toBeNull();
    });
  });

  describe('getFreeLimit', () => {
    it('무료 사용자는 초대로 늘어난 자리를 반영한 서버 한도를 안내한다', () => {
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

    it.each(['PREMIUM', 'ADMIN'] as const)('%s는 카탈로그의 무료 한도를 안내한다', (tier) => {
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
});
