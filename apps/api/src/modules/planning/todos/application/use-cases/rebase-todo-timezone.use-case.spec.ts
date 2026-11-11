import { vi } from "vitest";

import { TodoTitle } from "#api/modules/planning/shared/domain/todo-title.vo";
import { TodoSeriesId } from "#api/modules/planning/todo-series/domain/todo-series-id.vo";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { toIsoString } from "#api/shared/domain/time/instant";
import {
  createPlanningTodoFixture,
  createPlanningTodo,
} from "#test/fixtures/planning/planning-todos.fixture";

import { localTimeIn } from "../../../shared/domain/todo-calendar.domain-service.js";
import { RepeatRule } from "../../../todo-series/domain/repeat-rule.vo.js";
import { TodoSeries } from "../../../todo-series/domain/todo-series.aggregate.js";
import { RebaseTodoTimezoneUseCase } from "./rebase-todo-timezone.use-case.js";

const NOW = new Date("2026-11-05T12:00:00.000Z");
const SEOUL = "Asia/Seoul";
const NEW_YORK = "America/New_York";

function timedTodo(id: number, date: string, overrides: object = {}) {
  return {
    ...createPlanningTodo("planning-user", id),
    startDate: Temporal.PlainDate.from(date),
    scheduledLocalTime: "10:00",
    scheduledTime: Temporal.Instant.from(`${date}T01:00:00.000Z`),
    isAllDay: false,
    ...overrides,
  };
}

describe("시간대 재계산", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  const setUp = (todos: ReturnType<typeof timedTodo>[], timezone: string, batchSize?: number) => {
    fixture = createPlanningTodoFixture({ todos });
    fixture.ownerTimezone.timezones.set(fixture.userId, timezone);
    return new RebaseTodoTimezoneUseCase({ ...fixture, batchSize });
  };
  const readInstant = (id: number) => {
    const scheduledTime = fixture.records.get(id)?.scheduledTime;
    return scheduledTime == null ? undefined : toIsoString(scheduledTime);
  };

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
    expect(readInstant(1)).toBe(instant);
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
    expect(readInstant(1)).toBe(instant);
    expect(fixture.records.get(1)?.scheduledLocalTime).toBe(localTime);
  });

  it("완료했거나 지난 할 일도 다시 계산하고 종일은 건드리지 않는다", async () => {
    // Given
    const todos = [
      timedTodo(1, "2026-11-10"),
      timedTodo(2, "2026-11-10", { completed: true, completedAt: NOW }),
      timedTodo(3, "2026-11-10", { scheduledLocalTime: null, scheduledTime: null, isAllDay: true }),
      timedTodo(4, "2024-01-15", { completed: true, completedAt: NOW }),
      timedTodo(5, "2026-11-01"),
      timedTodo(6, "2026-11-01", { endDate: Temporal.PlainDate.from("2026-11-12") }),
    ];
    const useCase = setUp(todos, NEW_YORK);
    // When
    const result = await useCase.execute({ userId: "planning-user" });
    // Then
    expect(result).toMatchObject({ scannedCount: 5, rebasedCount: 5 });
    expect(readInstant(1)).toBe("2026-11-10T15:00:00.000Z");
    expect(readInstant(2)).toBe("2026-11-10T15:00:00.000Z");
    expect(fixture.records.get(3)?.scheduledTime).toBeNull();
    expect(readInstant(4)).toBe("2024-01-15T15:00:00.000Z");
    expect(readInstant(5)).toBe("2026-11-01T15:00:00.000Z");
    expect(readInstant(6)).toBe("2026-11-01T15:00:00.000Z");
  });

  it.each([
    {
      name: "완료 전 앞으로 울릴 회차",
      overrides: {},
      date: "2026-11-10",
      cancelled: [1],
      scheduled: [1],
    },
    {
      name: "완료한 앞으로 회차",
      overrides: { completed: true, completedAt: NOW },
      date: "2026-11-10",
      cancelled: [],
      scheduled: [],
    },
    {
      name: "완료 전 지난 회차",
      overrides: {},
      date: "2026-11-01",
      cancelled: [],
      scheduled: [],
    },
    {
      name: "완료한 지난 회차",
      overrides: { completed: true, completedAt: NOW },
      date: "2024-01-15",
      cancelled: [],
      scheduled: [],
    },
    {
      name: "옛 시각은 앞으로였는데 새 시간대에서 지난 회차",
      overrides: {
        scheduledLocalTime: "01:00",
        scheduledTime: Temporal.Instant.from("2026-11-05T13:00:00.000Z"),
      },
      date: "2026-11-05",
      cancelled: [1],
      scheduled: [1],
    },
  ])("$name: 알림 예약은 이 회차만 건드린다", async ({ overrides, date, cancelled, scheduled }) => {
    // Given
    const useCase = setUp([timedTodo(1, date, overrides)], NEW_YORK);
    // When
    const result = await useCase.execute({ userId: "planning-user" });
    // Then
    expect(result.rebasedCount).toBe(1);
    expect(fixture.todoReminder.cancelled).toEqual(cancelled);
    expect(fixture.todoReminder.scheduled.map(({ todoId }) => todoId)).toEqual(scheduled);
  });

  it("옛 앱은 지난 할 일도 새 기기 시간대에서 고른 시각으로 읽는다", async () => {
    // Given
    const useCase = setUp(
      [timedTodo(1, "2026-01-15", { completed: true, completedAt: NOW })],
      NEW_YORK,
    );
    // When
    await useCase.execute({ userId: "planning-user" });
    // Then
    const instant = fixture.records.get(1)?.scheduledTime;
    expect(instant == null ? null : localTimeIn(instant, NEW_YORK)).toBe("10:00");
  });

  it("서쪽으로 가서 다시 앞으로가 된 어제 날짜 회차만 예약 대상으로 넘긴다", async () => {
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
      scheduledTime: toIsoString(scheduledTime),
    }));
    expect(scheduled).toEqual([{ todoId: 1, scheduledTime: "2026-11-06T06:00:00.000Z" }]);
    expect(readInstant(2)).toBe("2026-11-05T11:00:00.000Z");
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
    const past = "2026-01-15T01:00:00.000Z";
    const useCase = setUp(
      [
        timedTodo(1, "2026-11-10"),
        timedTodo(2, "2026-01-15", { completed: true, completedAt: NOW }),
      ],
      NEW_YORK,
    );
    // When
    await useCase.execute({ userId: "planning-user" });
    const away = readInstant(1);
    const again = await useCase.execute({ userId: "planning-user" });
    fixture.ownerTimezone.timezones.set(fixture.userId, SEOUL);
    await useCase.execute({ userId: "planning-user" });
    // Then
    expect(away).toBe("2026-11-10T15:00:00.000Z");
    expect(again.rebasedCount).toBe(0);
    expect(readInstant(1)).toBe(before);
    expect(readInstant(2)).toBe(past);
  });

  it("이 할 일만 바꾼 회차의 벽시계를 규칙 값으로 덮어쓰지 않는다", async () => {
    // Given
    const useCase = setUp(
      [
        timedTodo(1, "2026-11-10", { seriesId: "series-1" }),
        timedTodo(2, "2026-11-11", {
          seriesId: "series-1",
          scheduledLocalTime: "15:00",
          scheduledTime: Temporal.Instant.from("2026-11-11T06:00:00.000Z"),
        }),
      ],
      NEW_YORK,
    );
    // When
    await useCase.execute({ userId: "planning-user" });
    // Then
    expect(fixture.records.get(2)?.scheduledLocalTime).toBe("15:00");
    expect(readInstant(2)).toBe("2026-11-11T20:00:00.000Z");
  });

  it("규칙 시간대를 바꿔 이후 회차가 현지 시각으로 만들어진다", async () => {
    // Given
    const useCase = setUp([], NEW_YORK);
    fixture.seriesStore.set(
      "series-1",
      TodoSeries.create({
        id: TodoSeriesId.reconstitute("series-1"),
        userId: UserId.reconstitute(fixture.userId),
        categoryId: 1,
        title: TodoTitle.create("회차"),
        visibility: "PUBLIC",
        scheduledLocalTime: "10:00",
        timezone: SEOUL,
        rule: RepeatRule.create({ frequency: "DAILY", end: { type: "NEVER" } }),
        startDate: "2026-11-10",
        checklistTemplate: [],
        now: Temporal.Instant.fromEpochMilliseconds(NOW.getTime()),
      }),
    );
    // When
    const result = await useCase.execute({ userId: "planning-user" });
    const drafts = fixture.seriesStore.get("series-1")?.planOccurrences("2026-11-10");
    // Then
    expect(result.seriesCount).toBe(1);
    expect(drafts?.[0]?.scheduledTime).toEqual(Temporal.Instant.from("2026-11-10T15:00:00.000Z"));
  });

  it("벽시계 칸이 빈 행은 건너뛰어 세고 순간을 망가뜨리지 않는다", async () => {
    // Given
    const useCase = setUp([timedTodo(1, "2026-11-10", { scheduledLocalTime: null })], NEW_YORK);
    // When
    const result = await useCase.execute({ userId: "planning-user" });
    // Then
    expect(result).toMatchObject({ skippedCount: 1, rebasedCount: 0 });
    expect(readInstant(1)).toBe("2026-11-10T01:00:00.000Z");
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
    expect(invalidate).toHaveBeenCalledWith(UserId.reconstitute(fixture.userId));
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
    expect(readInstant(3)).toBe("2026-11-10T01:00:00.000Z");
  });

  it("설정 행이 없으면(탈퇴) 조용히 끝난다", async () => {
    // Given
    const useCase = setUp([timedTodo(1, "2026-11-10")], NEW_YORK);
    fixture.ownerTimezone.timezones.clear();
    // When
    const result = await useCase.execute({ userId: "planning-user" });
    // Then
    expect(result.outcome).toBe("NO_PREFERENCE");
    expect(readInstant(1)).toBe("2026-11-10T01:00:00.000Z");
  });

  it("저장된 시간대가 잘못됐으면 기본값으로 계산한다", async () => {
    // Given
    const useCase = setUp(
      [
        timedTodo(1, "2026-11-10", {
          scheduledTime: Temporal.Instant.from("2026-11-10T10:00:00.000Z"),
        }),
      ],
      "Mars/Phobos",
    );
    // When
    await useCase.execute({ userId: "planning-user" });
    // Then
    expect(readInstant(1)).toBe("2026-11-10T01:00:00.000Z");
  });

  it("로그에 건수만 남기고 제목을 남기지 않는다", async () => {
    // Given
    const useCase = setUp([timedTodo(1, "2026-11-10", { title: "비밀 제목" })], NEW_YORK);
    // When
    await useCase.execute({ userId: "planning-user" });
    // Then
    const logged = JSON.stringify(fixture.logger.messages);
    expect(logged).toContain("planning.todo.timezone-rebase.completed");
    expect(logged).toContain('"rebasedCount":1');
    expect(logged).not.toContain("비밀 제목");
  });
});
