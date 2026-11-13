import { evaluateNudgeCooldown } from "./nudge-cooldown.domain-service.js";

const LAST_SENT_AT = Temporal.Instant.from("2026-07-26T00:00:00Z");

describe("evaluateNudgeCooldown", () => {
  it("할 일 콕은 24시간 동안 다시 보낼 수 없다", () => {
    // Given
    const now = LAST_SENT_AT.add({ minutes: 61 });

    // When
    const cooldown = evaluateNudgeCooldown({ lastSentAt: LAST_SENT_AT, now });

    // Then
    expect(cooldown).toEqual({
      isActive: true,
      remainingSeconds: (24 * 60 - 61) * 60,
      endsAt: LAST_SENT_AT.add({ hours: 24 }),
    });
  });
});
