import { ErrorCode } from "@aido/api/errors";

import {
  createPlanningTodo,
  createPlanningTodoFixture,
} from "#test/fixtures/planning/planning-todos.fixture";
import { createPlanningTodoRecordFixture } from "#test/fixtures/planning/todo-response.fixture";
import { createTodoSeriesFixture } from "#test/fixtures/planning/todo-series.fixture";

const START = Temporal.PlainDate.from("2026-11-10");

function occurrence(input: {
  readonly id: number;
  readonly userId: string;
  readonly seriesId: string;
  readonly occurrenceDate: Temporal.PlainDate | null;
}) {
  return createPlanningTodoRecordFixture({
    userId: input.userId,
    id: input.id,
    startDate: input.occurrenceDate ?? START,
    seriesId: input.seriesId,
    occurrenceDate: input.occurrenceDate,
  });
}

function publishedSeriesFacts(fixture: ReturnType<typeof createPlanningTodoFixture>) {
  return fixture.eventPublisher.publishedEvents
    .filter(({ eventName }) => eventName.startsWith("planning.todo-series."))
    .map((event) => ({ eventName: event.eventName, payload: event.toPayload() }));
}

describe("반복 회차 범위 삭제", () => {
  it("이후 모두 고치기와 같은 카테고리·순서 잠금을 한 번에 잡은 뒤 반복이 아닌 할 일은 TODO_0844로 거절한다", async () => {
    // Given
    const fixture = createPlanningTodoFixture({ todos: [createPlanningTodo()] });

    // When
    const result = fixture.deleteOccurrences.execute({
      todoId: 1,
      userId: fixture.userId,
      scope: "ALL",
    });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0844 });
    expect(fixture.mutationLock.acquiredKeys).toEqual([
      [
        `mutation:v1:todo-category:${fixture.userId}`,
        `mutation:v1:todo-sort-order:${fixture.userId}`,
      ],
    ]);
    expect(fixture.records.has(1)).toBe(true);
  });

  it("규칙 없는 묶음(규칙 행 없음)을 모두 지우면 지운 회차가 바뀐 사실을 낸다", async () => {
    // Given
    const userId = "planning-user";
    const fixture = createPlanningTodoFixture({
      todos: [1, 2].map((id) =>
        occurrence({ id, userId, seriesId: "legacy-bundle", occurrenceDate: null }),
      ),
    });

    // When
    await fixture.deleteOccurrences.execute({ todoId: 1, userId, scope: "ALL" });

    // Then
    expect(fixture.records.size).toBe(0);
    expect(publishedSeriesFacts(fixture)).toEqual([
      {
        eventName: "planning.todo-series.occurrences-changed",
        payload: expect.objectContaining({ seriesId: "legacy-bundle", userId }),
      },
    ]);
  });

  it("규칙 행이 있는 반복을 모두 지우면 회차가 바뀐 사실을 한 번만 낸다", async () => {
    // Given
    const userId = "planning-user";
    const series = createTodoSeriesFixture({ userId });
    const fixture = createPlanningTodoFixture({
      todos: [1, 2].map((id) =>
        occurrence({ id, userId, seriesId: series.id.value, occurrenceDate: START }),
      ),
    });
    fixture.seriesStore.set(series.id.value, series);

    // When
    await fixture.deleteOccurrences.execute({ todoId: 1, userId, scope: "ALL" });

    // Then
    expect(fixture.records.size).toBe(0);
    expect(publishedSeriesFacts(fixture)).toEqual([
      {
        eventName: "planning.todo-series.occurrences-changed",
        payload: expect.objectContaining({ seriesId: series.id.value, userId }),
      },
    ]);
  });

  it("이미 끝난 규칙이라 규칙 값이 그대로여도 이후 회차를 지우면 회차가 바뀐 사실을 낸다", async () => {
    // Given
    const userId = "planning-user";
    const series = createTodoSeriesFixture({
      userId,
      rule: {
        frequency: "DAILY",
        interval: 1,
        weekdays: null,
        monthDay: null,
        end: { type: "UNTIL", date: START.toString() },
      },
      nextOccurrenceDate: null,
      generatedCount: 1,
    });
    const fixture = createPlanningTodoFixture({
      todos: [occurrence({ id: 1, userId, seriesId: series.id.value, occurrenceDate: START })],
    });
    fixture.seriesStore.set(series.id.value, series);

    // When
    await fixture.deleteOccurrences.execute({ todoId: 1, userId, scope: "THIS_AND_FOLLOWING" });

    // Then
    expect(fixture.records.size).toBe(0);
    expect(publishedSeriesFacts(fixture)).toEqual([
      {
        eventName: "planning.todo-series.occurrences-changed",
        payload: expect.objectContaining({ seriesId: series.id.value, userId }),
      },
    ]);
  });
});
