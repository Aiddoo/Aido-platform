import { REMINDER_LATE_LIMIT_MINUTES } from "../../shared/domain/reminder-occurrence.domain-service.js";
import {
  snoozedReminderLateSkipReason,
  snoozedReminderTiming,
} from "./reminder-snooze.domain-service.js";

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

describe("다시 알림 문구 시점", () => {
  const SENT_AT = Temporal.Instant.from("2026-11-18T09:40:00Z");

  it.each([
    {
      name: "할 일 시각 전에 보내면",
      scheduledAt: SENT_AT.add({ minutes: 1 }),
      timing: "before-start",
    },
    { name: "할 일 시각에 보내면", scheduledAt: SENT_AT, timing: "started" },
    {
      name: "할 일 시각 뒤에 보내면",
      scheduledAt: SENT_AT.subtract({ minutes: 1 }),
      timing: "started",
    },
    { name: "시각 없는 할 일이면", scheduledAt: null, timing: "started" },
  ])("$name $timing 문구다", ({ scheduledAt, timing }) => {
    // When
    const result = snoozedReminderTiming({ sentAt: SENT_AT, scheduledAt });

    // Then
    expect(result).toBe(timing);
  });
});
