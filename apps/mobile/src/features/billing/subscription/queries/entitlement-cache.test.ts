import { HOUR_MS, MINUTE_MS } from '@src/shared/constants/time-units';
import { toInstant } from '@src/shared/date/instant';

import { createEntitlementSnapshot } from '../__tests__/entitlement.fixtures';
import { getEntitlementsRefetchInterval } from './entitlement-cache';

describe('getEntitlementsRefetchInterval', () => {
  it('가장 먼저 오는 초기화(콕 하루 한도의 자정) 순간에 다시 받는다', () => {
    // Given
    // 콕(하루)은 11-05 15:00Z, AI 정리(한 달)는 11-30 15:00Z에 초기화된다
    const snapshot = createEntitlementSnapshot();

    // When
    const intervalMs = getEntitlementsRefetchInterval(
      snapshot,
      toInstant('2026-11-05T14:30:00.000Z'),
    );

    // Then
    expect(intervalMs).toBe(30 * MINUTE_MS);
  });

  it('초기화가 하루보다 멀면 타이머 상한을 넘지 않게 하루 뒤 다시 잰다', () => {
    // Given
    const snapshot = createEntitlementSnapshot();

    // When
    const intervalMs = getEntitlementsRefetchInterval(
      snapshot,
      toInstant('2026-11-01T00:00:00.000Z'),
    );

    // Then
    expect(intervalMs).toBe(24 * HOUR_MS);
  });

  it('서버 시계가 늦어 이미 지난 초기화를 다시 주면 1분 뒤 다시 묻는다', () => {
    // Given
    const snapshot = createEntitlementSnapshot();

    // When
    const intervalMs = getEntitlementsRefetchInterval(
      snapshot,
      toInstant('2026-11-05T15:00:05.000Z'),
    );

    // Then
    expect(intervalMs).toBe(MINUTE_MS);
  });

  it('초기화가 없는 스냅샷(관리자)과 아직 받지 못한 스냅샷은 시각으로 다시 묻지 않는다', () => {
    // Given
    const now = toInstant('2026-11-05T14:30:00.000Z');
    const admin = createEntitlementSnapshot({ tier: 'ADMIN' });

    // When
    const adminInterval = getEntitlementsRefetchInterval(admin, now);
    const pendingInterval = getEntitlementsRefetchInterval(undefined, now);

    // Then
    expect(adminInterval).toBe(false);
    expect(pendingInterval).toBe(false);
  });
});
