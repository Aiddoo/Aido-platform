import {
  evaluateNudgeCooldown,
  evaluateRemindNudgeCooldown,
} from "./nudge-cooldown.domain-service.js";

const LAST_SENT_AT = Temporal.Instant.from("2026-07-26T00:00:00Z");

describe("콕 쿨다운", () => {
  it("할 일 콕은 24시간, 리마인드 콕은 1시간 동안 다시 보낼 수 없다", () => {
    // Given
    const now = LAST_SENT_AT.add({ minutes: 61 });

    // When
    const nudge = evaluateNudgeCooldown({ lastSentAt: LAST_SENT_AT, now });
    const reminder = evaluateRemindNudgeCooldown({ lastSentAt: LAST_SENT_AT, now });

    // Then
    expect(nudge).toEqual({
      isActive: true,
      remainingSeconds: (24 * 60 - 61) * 60,
      endsAt: LAST_SENT_AT.add({ hours: 24 }),
    });
    expect(reminder).toEqual({ isActive: false, remainingSeconds: 0, endsAt: null });
  });
});
