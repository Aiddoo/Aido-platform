import { evaluateReminderNudgeCooldown } from "./reminder-nudge-cooldown.domain-service.js";

const LAST_SENT_AT = Temporal.Instant.from("2026-07-26T00:00:00Z");

describe("evaluateReminderNudgeCooldown", () => {
  it.each([
    {
      minutes: 59,
      expected: {
        isActive: true,
        remainingSeconds: 60,
        endsAt: LAST_SENT_AT.add({ hours: 1 }),
      },
    },
    { minutes: 61, expected: { isActive: false, remainingSeconds: 0, endsAt: null } },
  ])("마지막 리마인드 뒤 $minutes분이면 한 시간 쿨다운으로 판단한다", ({ minutes, expected }) => {
    // When
    const cooldown = evaluateReminderNudgeCooldown({
      lastSentAt: LAST_SENT_AT,
      now: LAST_SENT_AT.add({ minutes }),
    });

    // Then
    expect(cooldown).toEqual(expected);
  });
});
