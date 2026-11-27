import { toInstant } from '@src/shared/date/instant';

import { type NudgeCooldown, NudgeCooldownPolicy } from './nudge-cooldown.model';

describe('NudgeCooldownPolicy', () => {
  describe('canNudgeAfterCooldown', () => {
    // 10:00Z에 끝나는 쿨다운을 받은 뒤 화면을 켜 두었다
    const COOLING_DOWN: NudgeCooldown = {
      canNudge: false,
      cooldownEndsAt: toInstant('2026-11-18T10:00:00.000Z'),
      remainingSeconds: 3600,
    };

    it.each([
      { now: '2026-11-18T09:59:59.999Z', expected: false },
      { now: '2026-11-18T10:00:00.000Z', expected: true },
    ])('쿨다운이 10:00Z에 끝나면 $now에 찌를 수 있음은 $expected다', ({ now, expected }) => {
      // When
      const canNudge = NudgeCooldownPolicy.canNudgeAfterCooldown(COOLING_DOWN, toInstant(now));

      // Then
      expect(canNudge).toBe(expected);
    });

    it('서버가 찌를 수 있다고 했으면 쿨다운 끝 순간과 무관하게 찌를 수 있다', () => {
      // Given
      const available: NudgeCooldown = {
        canNudge: true,
        cooldownEndsAt: null,
        remainingSeconds: null,
      };

      // When
      const canNudge = NudgeCooldownPolicy.canNudgeAfterCooldown(
        available,
        toInstant('2026-11-18T09:00:00.000Z'),
      );

      // Then
      expect(canNudge).toBe(true);
    });
  });
});
