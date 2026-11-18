import { TimeZone } from "#api/shared/domain/time/time-zone.vo";

import {
  createSnoozedReminderMetadata,
  createTodoReminderMetadata,
  todoReminderPushEndsAt,
} from "./reminder-occurrence.domain-service.js";

const SEOUL = TimeZone.reconstitute("Asia/Seoul");
const REMIND_AT = Temporal.Instant.from("2026-11-18T01:10:00Z");

describe("todoReminderPushEndsAt — 할 일 리마인더 푸시가 쓸모를 잃는 순간", () => {
  it.each([
    { stage: "60min", occurrenceKey: "2026-11-18T10:00", endsAt: "2026-11-18T01:00:00Z" },
    { stage: "10min", occurrenceKey: "2026-11-18T10:00", endsAt: "2026-11-18T01:00:00Z" },
    { stage: "60min", occurrenceKey: "2026-11-18", endsAt: null },
  ])(
    "$stage 단계는 회차 $occurrenceKey를 받는 사람 시간대로 읽은 할 일 시작이다",
    ({ stage, occurrenceKey, endsAt }) => {
      // When
      const result = todoReminderPushEndsAt(
        { metadata: { stage }, reminderOccurrenceKey: occurrenceKey },
        SEOUL,
      );

      // Then
      expect(result?.toString() ?? null).toBe(endsAt);
    },
  );

  it("시작 시각을 남긴 회차 알림은 받는 사람 시간대가 바뀌어도 남긴 시작에서 끝난다", () => {
    // Given
    const startsAt = Temporal.Instant.from("2026-11-18T01:00:00Z");
    const movedEast = TimeZone.reconstitute("Pacific/Auckland");

    // When
    const result = todoReminderPushEndsAt(
      {
        metadata: createTodoReminderMetadata("60min", startsAt),
        reminderOccurrenceKey: "2026-11-18T10:00",
      },
      movedEast,
    );

    // Then
    expect(result?.toString()).toBe("2026-11-18T01:00:00Z");
  });

  it("종일 할 일은 시작 시각 없이 단계만 남긴다", () => {
    // When
    const metadata = createTodoReminderMetadata("60min", null);

    // Then
    expect(metadata).toEqual({ stage: "60min" });
  });

  it("다시 알림은 울릴 시각에서 처리기의 늦음 한도 15분 뒤에 끝난다", () => {
    // When
    const result = todoReminderPushEndsAt(
      { metadata: createSnoozedReminderMetadata(REMIND_AT), reminderOccurrenceKey: "1024" },
      SEOUL,
    );

    // Then
    expect(result?.toString()).toBe("2026-11-18T01:25:00Z");
  });

  it.each([
    {
      name: "날짜·시각 모양이어도",
      remindAt: REMIND_AT.toString(),
      endsAt: "2026-11-18T01:25:00Z",
    },
    { name: "울릴 시각이 없으면", remindAt: undefined, endsAt: null },
    { name: "울릴 시각을 읽지 못하면", remindAt: "not-an-instant", endsAt: null },
  ])("다시 알림의 회차 칸은 $name 회차로 읽지 않는다", ({ remindAt, endsAt }) => {
    // When
    const result = todoReminderPushEndsAt(
      { metadata: { stage: "snooze", remindAt }, reminderOccurrenceKey: "2026-11-18T10:00" },
      SEOUL,
    );

    // Then
    expect(result?.toString() ?? null).toBe(endsAt);
  });
});
