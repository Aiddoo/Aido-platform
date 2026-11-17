import { REMINDER_LATE_LIMIT_MINUTES } from "./notification-schedule.domain-service.js";
import { snoozedReminderLateSkipReason } from "./reminder-snooze.domain-service.js";

describe("늦게 꺼낸 다시 알림", () => {
  const REMIND_AT = Temporal.Instant.from("2026-11-18T09:40:00Z");

  it.each([
    { name: "울릴 시각에 꺼내면", now: REMIND_AT, reason: null },
    { name: "15분 늦게 꺼내면", now: REMIND_AT.add({ minutes: 15 }), reason: null },
    {
      name: "15분 1ms 늦게 꺼내면",
      now: REMIND_AT.add({ minutes: 15, milliseconds: 1 }),
      reason: "late-over-15m",
    },
  ])("$name 사유는 $reason이다", ({ now, reason }) => {
    // When
    const result = snoozedReminderLateSkipReason({
      remindAt: REMIND_AT,
      now,
      limitMinutes: REMINDER_LATE_LIMIT_MINUTES,
    });

    // Then
    expect(result).toBe(reason);
  });
});
