import { toInstant } from '@src/shared/date/instant';

import { isWithinInviteRedeemWindow } from './invite-redeem-window.model';

describe('isWithinInviteRedeemWindow', () => {
  it.each([
    { now: '2026-10-25T23:59:59.999Z', expected: true },
    { now: '2026-10-26T00:00:00.000Z', expected: false },
  ])('10월 19일 0시에 시작했으면 $now에 기간 안인지는 $expected다', ({ now, expected }) => {
    // Given
    const startedAt = toInstant('2026-10-19T00:00:00.000Z');

    // When
    const result = isWithinInviteRedeemWindow(startedAt, toInstant(now));

    // Then
    // 7일 = 7 × 24시간, 끝 순간은 기간 밖이다
    expect(result).toBe(expected);
  });
});
