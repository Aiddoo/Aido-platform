import { HOUR_MS, MINUTE_MS } from '@src/shared/constants/time-units';
import { toInstant } from '@src/shared/date/instant';

import { createEntitlementSnapshot } from '../__tests__/entitlement.fixtures';
import { getEntitlementsRefetchIntervalMs } from './entitlement.queries';

describe('getEntitlementsRefetchIntervalMs', () => {
  // 콕(하루)은 11-05 15:00Z, AI 정리(한 달)는 11-30 15:00Z에 초기화된다
  const snapshot = createEntitlementSnapshot();

  it('가장 먼저 오는 초기화(콕 하루 한도의 자정) 순간에 다시 받는다', () => {
    // When
    const intervalMs = getEntitlementsRefetchIntervalMs(
      snapshot,
      toInstant('2026-11-05T14:30:00.000Z'),
    );

    // Then
    expect(intervalMs).toBe(30 * MINUTE_MS);
  });

  it('초기화가 1분 안이면 너무 잦게 묻지 않게 1분 뒤 다시 받는다', () => {
    // When
    const intervalMs = getEntitlementsRefetchIntervalMs(
      snapshot,
      toInstant('2026-11-05T14:59:30.000Z'),
    );

    // Then
    expect(intervalMs).toBe(MINUTE_MS);
  });

  it('초기화가 하루보다 멀면 타이머 상한을 넘지 않게 하루 뒤 다시 잰다', () => {
    // When
    const intervalMs = getEntitlementsRefetchIntervalMs(
      snapshot,
      toInstant('2026-11-01T00:00:00.000Z'),
    );

    // Then
    expect(intervalMs).toBe(24 * HOUR_MS);
  });

  it('이미 지난 초기화와 올 초기화가 섞여 있으면 올 초기화에 맞춘다', () => {
    // When
    const intervalMs = getEntitlementsRefetchIntervalMs(
      snapshot,
      toInstant('2026-11-30T14:30:00.000Z'),
    );

    // Then
    expect(intervalMs).toBe(30 * MINUTE_MS);
  });

  it('초기화가 모두 지났으면 1분마다 묻지 않고 시각으로 다시 묻지 않는다', () => {
    // When
    const intervalMs = getEntitlementsRefetchIntervalMs(
      snapshot,
      toInstant('2026-11-30T15:00:05.000Z'),
    );

    // Then
    expect(intervalMs).toBe(false);
  });

  it('초기화가 없는 스냅샷은 시각으로 다시 묻지 않는다', () => {
    // Given
    const withoutResets = { ...createEntitlementSnapshot(), features: {} };

    // When
    const intervalMs = getEntitlementsRefetchIntervalMs(
      withoutResets,
      toInstant('2026-11-05T14:30:00.000Z'),
    );

    // Then
    expect(intervalMs).toBe(false);
  });

  it('관리자도 프리미엄처럼 공정 사용 상한의 초기화에 맞춰 다시 받는다', () => {
    // Given
    const admin = createEntitlementSnapshot({ tier: 'ADMIN' });

    // When
    const intervalMs = getEntitlementsRefetchIntervalMs(
      admin,
      toInstant('2026-11-30T14:30:00.000Z'),
    );

    // Then
    expect(intervalMs).toBe(30 * MINUTE_MS);
  });
});
