import { vi } from "vitest";

import {
  createPlanningTodoFixture,
  createPlanningTodo,
} from "#test/fixtures/planning-todo.fixture";

import { TodoSeries } from "../../../domain/aggregates/series/todo-series.aggregate.js";
import { RepeatRule } from "../../../domain/value-objects/series/repeat-rule.vo.js";
import { RebaseTodoTimezone } from "./rebase-todo-timezone.use-case.js";

const NOW = new Date("2026-11-05T12:00:00.000Z");
const SEOUL = "Asia/Seoul";
const NEW_YORK = "America/New_York";

function timedTodo(id: number, date: string, overrides: object = {}) {
  return {
    ...createPlanningTodo("planning-user", id),
    startDate: new Date(`${date}T00:00:00.000Z`),
    scheduledLocalTime: "10:00",
    scheduledTime: new Date(`${date}T01:00:00.000Z`),
    isAllDay: false,
    ...overrides,
  };
}

describe("시간대 재계산", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  const setUp = (todos: ReturnType<typeof timedTodo>[], timezone: string, batchSize?: number) => {
    fixture = createPlanningTodoFixture({ todos });
    fixture.ownerTimezone.timezones.set(fixture.userId, timezone);
    return new RebaseTodoTimezone({ ...fixture, batchSize });
  };
  const instantOf = (id: number) => fixture.records.get(id)?.scheduledTime?.toISOString();

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    { name: "서울 → 뉴욕", date: "2026-11-10", to: NEW_YORK, instant: "2026-11-10T15:00:00.000Z" },
    {
      name: "런던 서머타임 전날",
      date: "2027-03-27",
      to: "Europe/London",
      instant: "2027-03-27T10:00:00.000Z",
    },
    {
      name: "런던 서머타임 다음 날",
      date: "2027-03-29",
      to: "Europe/London",
      instant: "2027-03-29T09:00:00.000Z",
    },
    {
      name: "하와이(날짜가 하루 늦다)",
      date: "2026-11-06",
      to: "Pacific/Honolulu",
      instant: "2026-11-06T20:00:00.000Z",
    },
    {
      name: "UTC+14(날짜가 하루 빠르다)",
      date: "2026-11-06",
      to: "Pacific/Kiritimati",
      instant: "2026-11-05T20:00:00.000Z",
    },
  ])("$name: 고른 시각은 그대로이고 순간만 그 시간대로 바뀐다", async ({ date, to, instant }) => {
    // Given
    const useCase = setUp([timedTodo(1, date)], to);
    // When
    const result = await useCase.execute({ userId: "planning-user" });
    // Then
    expect(result).toMatchObject({ outcome: "COMPLETED", rebasedCount: 1 });
    expect(instantOf(1)).toBe(instant);
    expect(fixture.records.get(1)?.scheduledLocalTime).toBe("10:00");
    expect(fixture.todoReminder.cancelled).toContain(1);
  });

  it.each([
    {
      name: "뉴욕 겹치는 시각은 앞쪽",
      date: "2027-11-07",
      localTime: "01:30",
      instant: "2027-11-07T05:30:00.000Z",
    },
    {
      name: "뉴욕 없는 시각은 전환 뒤로 밀린다",
      date: "2027-03-14",
      localTime: "02:30",
      instant: "2027-03-14T07:30:00.000Z",
    },
  ])("서머타임 전환일 $name: 표시할 벽시계는 고른 값이다", async ({ date, localTime, instant }) => {
    // Given
    const useCase = setUp([timedTodo(1, date, { scheduledLocalTime: localTime })], NEW_YORK);
    // When
    await useCase.execute({ userId: "planning-user" });
    // Then
    expect(instantOf(1)).toBe(instant);
    expect(fixture.records.get(1)?.scheduledLocalTime).toBe(localTime);
  });

  it("앞으로 할 일만 다시 계산하고 완료·종일·그제 이전은 건드리지 않는다", async () => {
    // Given
    const todos = [
      timedTodo(1, "2026-11-10"),
      timedTodo(2, "2026-11-10", {
        completed: true,
        completedAt: NOW,
      }),
      timedTodo(3, "2026-11-10", { scheduledLocalTime: null, scheduledTime: null, isAllDay: true }),
      timedTodo(4, "2026-11-03"),
      timedTodo(5, "2026-11-04"),
      timedTodo(6, "2026-11-10", { endDate: new Date("2026-11-12T00:00:00.000Z") }),
      timedTodo(7, "2026-11-01", { endDate: new Date("2026-11-12T00:00:00.000Z") }),
    ];
    const useCase = setUp(todos, NEW_YORK);
    // When
    const result = await useCase.execute({ userId: "planning-user" });
    // Then
    expect(result).toMatchObject({ scannedCount: 3, rebasedCount: 3 });
    expect(fixture.records.get(2)?.scheduledTime).toEqual(todos[1]?.scheduledTime);
    expect(fixture.records.get(4)?.scheduledTime).toEqual(todos[3]?.scheduledTime);
    expect(fixture.records.get(7)?.scheduledTime).toEqual(todos[6]?.scheduledTime);
    expect(instantOf(5)).toBe("2026-11-04T15:00:00.000Z");
    expect(instantOf(6)).toBe("2026-11-10T15:00:00.000Z");
  });

  it("어제 날짜의 시각이 다시 미래가 되면 다시 예약하고 지난 시각은 예약하지 않는다", async () => {
    // Given
    const useCase = setUp(
      [
        timedTodo(1, "2026-11-05", { scheduledLocalTime: "20:00" }),
        timedTodo(2, "2026-11-05", { scheduledLocalTime: "01:00" }),
      ],
      "Pacific/Honolulu",
    );
    // When
    await useCase.execute({ userId: "planning-user" });
    // Then
    const scheduled = fixture.todoReminder.scheduled.map(({ todoId, scheduledTime }) => ({
      todoId,
      scheduledTime: scheduledTime.toISOString(),
    }));
    expect(scheduled).toContainEqual({ todoId: 1, scheduledTime: "2026-11-06T06:00:00.000Z" });
    expect(scheduled).toContainEqual({ todoId: 2, scheduledTime: "2026-11-05T11:00:00.000Z" });
  });

  it("같은 시각의 다른 이름이면 쓰기와 재예약을 하지 않는다", async () => {
    // Given
    const useCase = setUp([timedTodo(1, "2026-11-10")], "Asia/Tokyo");
    const update = vi.spyOn(fixture.todoRepository, "updateRebasedInstants");
    const invalidate = vi.spyOn(fixture.todoCache, "invalidateFriendTodos");
    // When
    const result = await useCase.execute({ userId: "planning-user" });
    // Then
    expect(result).toMatchObject({ scannedCount: 1, rebasedCount: 0 });
    expect(update).toHaveBeenCalledWith([]);
    expect(fixture.todoReminder.cancelled).toEqual([]);
    expect(fixture.todoReminder.scheduled).toEqual([]);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("서울 → 뉴욕 → 서울 왕복은 처음과 같고 다시 돌려도 바뀌지 않는다", async () => {
    // Given
    const before = "2026-11-10T01:00:00.000Z";
    const useCase = setUp([timedTodo(1, "2026-11-10")], NEW_YORK);
    // When
    await useCase.execute({ userId: "planning-user" });
    const away = instantOf(1);
    const again = await useCase.execute({ userId: "planning-user" });
    fixture.ownerTimezone.timezones.set(fixture.userId, SEOUL);
    await useCase.execute({ userId: "planning-user" });
    // Then
    expect(away).toBe("2026-11-10T15:00:00.000Z");
    expect(again.rebasedCount).toBe(0);
    expect(instantOf(1)).toBe(before);
  });

  it("이 할 일만 바꾼 회차의 벽시계를 규칙 값으로 덮어쓰지 않는다", async () => {
    // Given
    const useCase = setUp(
      [
        timedTodo(1, "2026-11-10", { seriesId: "series-1" }),
        timedTodo(2, "2026-11-11", {
          seriesId: "series-1",
          scheduledLocalTime: "15:00",
          scheduledTime: new Date("2026-11-11T06:00:00.000Z"),
        }),
      ],
      NEW_YORK,
    );
    // When
    await useCase.execute({ userId: "planning-user" });
    // Then
    expect(fixture.records.get(2)?.scheduledLocalTime).toBe("15:00");
    expect(instantOf(2)).toBe("2026-11-11T20:00:00.000Z");
  });

  it("규칙 시간대를 바꿔 이후 회차가 현지 시각으로 만들어진다", async () => {
    // Given
    const useCase = setUp([], NEW_YORK);
    fixture.seriesStore.set(
      "series-1",
      TodoSeries.planCreation({
        id: "series-1",
        userId: fixture.userId,
        categoryId: 1,
        title: "회차",
        visibility: "PUBLIC",
        scheduledLocalTime: "10:00",
        timezone: SEOUL,
        rule: RepeatRule.from({ frequency: "DAILY", end: { type: "NEVER" } }),
        startDate: "2026-11-10",
        checklistTemplate: [],
        at: NOW,
      }),
    );
    // When
    const result = await useCase.execute({ userId: "planning-user" });
    const drafts = fixture.seriesStore.get("series-1")?.planOccurrences("2026-11-10");
    // Then
    expect(result.seriesCount).toBe(1);
    expect(drafts?.[0]?.scheduledTime?.toISOString()).toBe("2026-11-10T15:00:00.000Z");
  });

  it("벽시계 칸이 빈 행은 건너뛰어 세고 순간을 망가뜨리지 않는다", async () => {
    // Given
    const useCase = setUp([timedTodo(1, "2026-11-10", { scheduledLocalTime: null })], NEW_YORK);
    // When
    const result = await useCase.execute({ userId: "planning-user" });
    // Then
    expect(result).toMatchObject({ skippedCount: 1, rebasedCount: 0 });
    expect(instantOf(1)).toBe("2026-11-10T01:00:00.000Z");
  });

  it("묶음을 나눠도 모든 행을 처리한다", async () => {
    // Given
    const useCase = setUp(
      [1, 2, 3, 4, 5].map((id) => timedTodo(id, "2026-11-10")),
      NEW_YORK,
      2,
    );
    const invalidate = vi.spyOn(fixture.todoCache, "invalidateFriendTodos");
    // When
    const result = await useCase.execute({ userId: "planning-user" });
    // Then
    expect(result).toMatchObject({ outcome: "COMPLETED", scannedCount: 5, rebasedCount: 5 });
    expect(invalidate).toHaveBeenCalledWith(fixture.userId);
  });

  it("실행 중 시간대가 또 바뀌면 남은 묶음을 멈추고 다음 작업에 맡긴다", async () => {
    // Given
    const useCase = setUp(
      [1, 2, 3].map((id) => timedTodo(id, "2026-11-10")),
      NEW_YORK,
      1,
    );
    const update = fixture.todoRepository.updateRebasedInstants.bind(fixture.todoRepository);
    vi.spyOn(fixture.todoRepository, "updateRebasedInstants").mockImplementationOnce(
      async (rows) => {
        await update(rows);
        fixture.ownerTimezone.timezones.set(fixture.userId, "Europe/Paris");
      },
    );
    // When
    const result = await useCase.execute({ userId: "planning-user" });
    // Then
    expect(result).toMatchObject({ outcome: "SUPERSEDED", scannedCount: 1 });
    expect(instantOf(3)).toBe("2026-11-10T01:00:00.000Z");
  });

  it("설정 행이 없으면(탈퇴) 조용히 끝난다", async () => {
    // Given
    const useCase = setUp([timedTodo(1, "2026-11-10")], NEW_YORK);
    fixture.ownerTimezone.timezones.clear();
    // When
    const result = await useCase.execute({ userId: "planning-user" });
    // Then
    expect(result.outcome).toBe("NO_PREFERENCE");
    expect(instantOf(1)).toBe("2026-11-10T01:00:00.000Z");
  });

  it("저장된 시간대가 잘못됐으면 기본값으로 계산한다", async () => {
    // Given
    const useCase = setUp(
      [timedTodo(1, "2026-11-10", { scheduledTime: new Date("2026-11-10T10:00:00.000Z") })],
      "Mars/Phobos",
    );
    // When
    await useCase.execute({ userId: "planning-user" });
    // Then
    expect(instantOf(1)).toBe("2026-11-10T01:00:00.000Z");
  });

  it("로그에 건수만 남기고 제목을 남기지 않는다", async () => {
    // Given
    const useCase = setUp([timedTodo(1, "2026-11-10", { title: "비밀 제목" })], NEW_YORK);
    // When
    await useCase.execute({ userId: "planning-user" });
    // Then
    const logged = JSON.stringify(fixture.logger.log.mock.calls);
    expect(logged).toContain("planning.todo.timezone-rebase.completed");
    expect(logged).toContain('"rebasedCount":1');
    expect(logged).not.toContain("비밀 제목");
  });
});
