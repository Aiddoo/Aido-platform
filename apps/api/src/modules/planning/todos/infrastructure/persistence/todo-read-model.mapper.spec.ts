import { TodoBuilder } from "#test/builders/index";

import type { RepeatRuleRow } from "../../../todo-series/infrastructure/persistence/repeat-rule-row.mapper.js";
import { toFriendTodoReadModel, toTodoReadModel } from "./todo-read-model.mapper.js";

const WEEKLY_RULE = {
  repeatFrequency: "WEEKLY",
  repeatInterval: 2,
  repeatWeekdays: ["MON", "THU"],
  repeatMonthDay: null,
  repeatUntil: null,
  repeatCount: null,
} satisfies RepeatRuleRow;

describe("할 일 Read Model 행 매퍼", () => {
  it("시각은 ms 3자리 UTC 문자열, 날짜 칸은 YYYY-MM-DD로 준다", () => {
    // Given
    const row = TodoBuilder.create("user-123")
      .withStartDate(Temporal.PlainDate.from("2024-01-15"))
      .withEndDate(Temporal.PlainDate.from("2024-01-16"))
      .withScheduledTime(Temporal.Instant.from("2024-01-15T10:00:00Z"))
      .withCreatedAt(Temporal.Instant.from("2024-01-10T12:00:00Z"))
      .build();

    // When
    const todo = toFriendTodoReadModel(row);

    // Then
    expect(todo).toMatchObject({
      startDate: "2024-01-15",
      endDate: "2024-01-16",
      scheduledTime: "2024-01-15T10:00:00.000Z",
      createdAt: "2024-01-10T12:00:00.000Z",
    });
  });

  it("순간이 없는 옛 행은 남은 벽시계 칸을 버린다", () => {
    // Given
    const row = { ...TodoBuilder.create("user-123").build(), scheduledLocalTime: "09:00" };

    // When
    const todo = toFriendTodoReadModel({ ...row, scheduledTime: null });

    // Then
    expect(todo.scheduledLocalTime).toBeNull();
  });

  it("규칙이 없으면 repeat와 occurrenceDate가 null이다", () => {
    // Given
    const row = TodoBuilder.create("user-123").build();

    // When
    const todo = toTodoReadModel({ ...row, series: null });

    // Then
    expect(todo).toMatchObject({ repeat: null, occurrenceDate: null });
  });

  it("규칙 행을 반복 규칙으로 바꾸고 회차 날짜를 YYYY-MM-DD로 준다", () => {
    // Given
    const row = TodoBuilder.create("user-123")
      .withSeriesId("series-1")
      .withOccurrenceDate(Temporal.PlainDate.from("2026-11-02"))
      .withStartDate(Temporal.PlainDate.from("2026-11-04"))
      .build();

    // When
    const todo = toTodoReadModel({ ...row, series: WEEKLY_RULE });

    // Then
    expect(todo).toMatchObject({
      seriesId: "series-1",
      repeat: {
        frequency: "WEEKLY",
        interval: 2,
        weekdays: ["MON", "THU"],
        end: { type: "NEVER" },
      },
      occurrenceDate: "2026-11-02",
      startDate: "2026-11-04",
    });
  });

  it("끝난 규칙도 종료 조건을 그대로 준다", () => {
    // Given
    const row = TodoBuilder.create("user-123").withSeriesId("series-1").build();

    // When
    const todo = toTodoReadModel({
      ...row,
      series: { ...WEEKLY_RULE, repeatUntil: Temporal.PlainDate.from("2026-12-31") },
    });

    // Then
    expect(todo.repeat).toMatchObject({ end: { type: "UNTIL", date: "2026-12-31" } });
  });
});
