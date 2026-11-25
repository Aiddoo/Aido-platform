import { toInstant } from '@src/shared/date/instant';

import { createFeatureQuotaDto } from '../__tests__/entitlement.fixtures';
import { toFeatureQuota } from '../apis/entitlement.mapper';
import { FeatureQuotaPolicy } from './feature-quota.model';

// 콕(하루)은 2026-11-05 15:00Z에 초기화된다
const RESETS_AT = toInstant('2026-11-05T15:00:00.000Z');
const BEFORE_RESET = toInstant('2026-11-05T14:30:00.000Z');
const AFTER_RESET = toInstant('2026-11-05T15:00:05.000Z');

function createUsedUpNudgeQuota() {
  return { ...toFeatureQuota(createFeatureQuotaDto('NUDGE', { used: 99 })), resetsAt: RESETS_AT };
}

describe('FeatureQuotaPolicy', () => {
  describe('findUpcomingResetAt', () => {
    it.each([
      ['초기화 전이면 초기화 순간', BEFORE_RESET, RESETS_AT],
      ['초기화가 지났으면 없음', AFTER_RESET, null],
    ])('%s을 반환한다', (_case, now, expected) => {
      // When
      const resetsAt = FeatureQuotaPolicy.findUpcomingResetAt(createUsedUpNudgeQuota(), now);

      // Then
      expect(resetsAt).toBe(expected);
    });
  });

  describe('getAccessDecision', () => {
    it.each([
      ['초기화 전에 다 썼으면 한도에 닿는다', BEFORE_RESET, 'limit-reached'],
      ['초기화가 지난 스냅샷의 남은 0은 믿지 않고 서버에 맡긴다', AFTER_RESET, 'allow'],
    ] as const)('%s', (_case, now, expected) => {
      // When
      const decision = FeatureQuotaPolicy.getAccessDecision(createUsedUpNudgeQuota(), now);

      // Then
      expect(decision).toBe(expected);
    });

    it('등급이 닫은 기능은 초기화 시각이 지나도 잠겨 있다', () => {
      // Given
      const quota = { ...createUsedUpNudgeQuota(), allowed: false };

      // When
      const decision = FeatureQuotaPolicy.getAccessDecision(quota, AFTER_RESET);

      // Then
      expect(decision).toBe('locked');
    });
  });

  describe('getStatus', () => {
    it('초기화가 지난 스냅샷은 다 쓴 상태로 보이지 않는다', () => {
      // When
      const status = FeatureQuotaPolicy.getStatus(createUsedUpNudgeQuota(), AFTER_RESET);

      // Then
      expect(status).toEqual({ type: 'untracked' });
    });

    it('초기화 전에 다 썼으면 그 기간의 소진이다', () => {
      // When
      const status = FeatureQuotaPolicy.getStatus(createUsedUpNudgeQuota(), BEFORE_RESET);

      // Then
      expect(status).toEqual({ type: 'used-up', period: 'day' });
    });
  });
});
