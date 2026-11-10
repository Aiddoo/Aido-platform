import { ErrorCode } from "@aido/api/errors";
import { type DayOfWeek, TODO_LIMITS, TODO_SERIES_LIMITS } from "@aido/api/vocabulary";
import { vi } from "vitest";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { copyTodoRecord } from "#test/doubles/planning/in-memory-todo.repository";
import {
  createPlanningTodoFixture,
  createPlanningTodo,
  PLANNING_TIME,
} from "#test/fixtures/planning/planning-todos.fixture";

import { TodoCategoryId } from "../../../categories/domain/todo-category-id.vo.js";
import { MAX_OCCURRENCES_PER_RUN } from "../../../todo-series/application/use-cases/materialize-todo-occurrences.use-case.js";
import { PublishTodoCreationUseCase } from "../../../todo-series/application/use-cases/publish-todo-creation.use-case.js";
import { StagedTodoCreatorAdapter } from "../../infrastructure/adapters/staged-todo-creator.adapter.js";
import { CreateTodoUseCase, type CreateTodoInput } from "./create-todo.use-case.js";
import { StageTodoCreationUseCase } from "./stage-todo-creation.use-case.js";
import { WriteTodoCreationUseCase } from "./write-todo-creation.use-case.js";

describe("할 일 생성", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  let useCase: CreateTodoUseCase;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PLANNING_TIME);
    fixture = createPlanningTodoFixture({ todos: [createPlanningTodo()] });
    useCase = new CreateTodoUseCase({
      ...fixture,
      todoCreator: new StagedTodoCreatorAdapter(
        new StageTodoCreationUseCase({
          ...fixture,
          writer: new WriteTodoCreationUseCase(fixture),
          effects: new PublishTodoCreationUseCase(fixture),
        }),
      ),
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([
    { name: "종일 기본값에 시간이 오면", isAllDay: true, scheduledTime: "09:30", allDay: false },
    { name: "시간 일정인데 시간이 없으면", isAllDay: false, scheduledTime: null, allDay: true },
  ])("$name 종일과 시간을 맞춰 저장한다", async ({ isAllDay, scheduledTime, allDay }) => {
    // Given
    fixture.records.clear();
    // When
    const {
      todos: [result],
    } = await useCase.execute({
      userId: UserId.reconstitute(fixture.userId),
      title: "시간 맞춤",
      categoryId: TodoCategoryId.reconstitute(1),
      startDate: new Date("2026-05-16T00:00:00Z"),
      scheduledTime,
      isAllDay,
      timezone: "Asia/Seoul",
    });
    // Then
    expect(result?.isAllDay).toBe(allDay);
    expect(result?.scheduledTime).toBe(allDay ? null : "2026-05-16T00:30:00.000Z");
  });

  it("인라인 항목과 기본값을 저장하고 생성 이벤트와 새 응답을 반환한다", async () => {
    // Given
    fixture.records.clear();
    fixture.todoCache.categoryUsers.add(fixture.userId);
    // When
    const { todos, series } = await useCase.execute({
      userId: UserId.reconstitute(fixture.userId),
      title: "새 할 일",
      categoryId: TodoCategoryId.reconstitute(1),
      startDate: new Date("2026-05-16T00:00:00Z"),
      timezone: "UTC",
      items: [{ title: "첫 항목" }, { title: "둘째 항목" }],
    });
    const result = todos[0];
    if (result == null) {
      throw new Error("생성 결과 누락");
    }
    // Then
    expect(fixture.records.get(result.id)).toMatchObject({
      title: "새 할 일",
      categoryId: 1,
      sortOrder: 0,
      completed: false,
      visibility: "PUBLIC",
    });
    expect(result).toMatchObject({
      title: "새 할 일",
      startDate: "2026-05-16",
    });
    expect(result.items.map((item) => item.title)).toEqual(["첫 항목", "둘째 항목"]);
    expect(fixture.eventPublisher.publishedEvents.map((event) => event.toPayload())).toEqual([
      { todoId: result.id, userId: fixture.userId, occurredAt: expect.any(String) },
    ]);
    expect(fixture.todoCache.categoryUsers.has(fixture.userId)).toBe(false);
    expect(series).toBeNull();
  });
  it("다른 소유자의 카테고리와 잘못된 제목을 거부하고 저장 상태를 보존한다", async () => {
    // Given
    fixture.categoryOwners.set(1, "other-user");
    const before = [...fixture.records.values()].map(copyTodoRecord);
    const input = {
      userId: UserId.reconstitute(fixture.userId),
      title: "새 할 일",
      categoryId: TodoCategoryId.reconstitute(1),
      startDate: PLANNING_TIME,
      timezone: "UTC",
    };
    // When / Then
    await expect(useCase.execute(input)).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_CATEGORY_0851,
    });
    await expect(useCase.execute({ ...input, title: "가".repeat(201) })).rejects.toMatchObject({
      errorCode: ErrorCode.SYS_0002,
    });
    expect([...fixture.records.values()]).toEqual(before);
    expect(fixture.eventPublisher.publishedEvents).toEqual([]);
  });
  it("활성 한도가 찬 카테고리는 생성을 거부한다", async () => {
    // Given
    for (let id = 2; id <= TODO_LIMITS.MAX_PER_CATEGORY; id++) {
      fixture.records.set(id, createPlanningTodo(fixture.userId, id));
    }
    // When / Then
    await expect(
      useCase.execute({
        userId: UserId.reconstitute(fixture.userId),
        title: "초과 할 일",
        categoryId: TodoCategoryId.reconstitute(1),
        startDate: PLANNING_TIME,
        timezone: "UTC",
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0811 });
    expect(fixture.records.size).toBe(TODO_LIMITS.MAX_PER_CATEGORY);
  });
  it.each(["cache"])(
    "단독 생성의 %s 실패는 커밋된 행을 두고 원래 오류를 전달한다",
    async (boundary) => {
      // Given
      fixture.records.clear();
      const failure = new Error(`${boundary} failure`);
      fixture.todoCache.invalidateTodoCategories = async () => {
        throw failure;
      };
      // When / Then
      await expect(
        useCase.execute({
          userId: UserId.reconstitute(fixture.userId),
          title: "새 할 일",
          categoryId: TodoCategoryId.reconstitute(1),
          startDate: PLANNING_TIME,
          timezone: "UTC",
        }),
      ).rejects.toBe(failure);
      expect(fixture.records.size).toBe(1);
    },
  );

  describe("반복 할 일", () => {
    const WEEKDAYS_MWF = {
      frequency: "WEEKLY",
      interval: 1,
      weekdays: ["MON", "WED", "FRI"] satisfies DayOfWeek[],
    } as const;

    function seriesInput(overrides: Partial<CreateTodoInput> = {}): CreateTodoInput {
      return {
        userId: UserId.reconstitute(fixture.userId),
        title: "반복 할 일",
        categoryId: TodoCategoryId.reconstitute(1),
        startDate: new Date("2026-05-18T00:00:00Z"),
        timezone: "UTC",
        repeat: { frequency: "DAILY", end: { type: "NEVER" } },
        ...overrides,
      };
    }

    beforeEach(() => {
      fixture.records.clear();
    });

    it("규칙을 저장하고 고른 요일에 연속 순서·체크리스트로 회차를 만들어 첫 회차를 맨 앞에 둔다", async () => {
      // Given
      const repeat = { ...WEEKDAYS_MWF, end: { type: "UNTIL", date: "2026-05-24" } } as const;
      // When
      const { todos, series } = await useCase.execute(
        seriesInput({ repeat, items: [{ title: "준비" }, { title: "실행" }] }),
      );
      // Then
      expect(todos.map((todo) => [todo.startDate, todo.sortOrder])).toEqual([
        ["2026-05-18", 0],
        ["2026-05-20", 1],
        ["2026-05-22", 2],
      ]);
      expect(todos.every((todo) => todo.seriesId === series?.id)).toBe(true);
      expect(todos.every((todo) => todo.items.length === 2)).toBe(true);
      expect(series).toMatchObject({ repeat, isActive: false, nextOccurrenceDate: null });
      expect(fixture.seriesStore.size).toBe(1);
    });

    it("계속 반복은 규칙 시간대 오늘+90일(포함)까지만 만들고 다음 회차를 커서에 남긴다", async () => {
      // Given
      const startDate = new Date("2026-05-15T00:00:00Z");
      // When
      const { todos, series } = await useCase.execute(seriesInput({ startDate }));
      // Then
      expect(todos).toHaveLength(TODO_SERIES_LIMITS.VISIBLE_AHEAD_DAYS + 1);
      expect(todos.at(-1)?.startDate).toBe("2026-08-13");
      expect(series).toMatchObject({ isActive: true, nextOccurrenceDate: "2026-08-14" });
    });

    it("이전 상한(100개)을 넘는 긴 날짜 범위도 성공하고 나머지는 커서에 남는다", async () => {
      // Given
      const repeat = { frequency: "DAILY", end: { type: "UNTIL", date: "2027-05-15" } } as const;
      // When
      const { todos, series } = await useCase.execute(seriesInput({ repeat }));
      // Then
      expect(todos.length).toBeLessThan(100);
      expect(series?.isActive).toBe(true);
    });

    it("90일 너머에서 시작해도 첫 회차는 바로 만든다", async () => {
      // Given
      const startDate = new Date("2027-01-01T00:00:00Z");
      // When
      const { todos, series } = await useCase.execute(seriesInput({ startDate }));
      // Then
      expect(todos.map((todo) => todo.startDate)).toEqual(["2027-01-01"]);
      expect(series?.nextOccurrenceDate).toBe("2027-01-02");
    });

    it("상한 안의 지난 시작일도 한 번에 상한까지만 만들고 나머지는 커서에 남긴다", async () => {
      // Given
      const startDate = new Date("2025-05-15T00:00:00Z");
      // When
      const { todos, series } = await useCase.execute(seriesInput({ startDate }));
      // Then
      expect(todos).toHaveLength(MAX_OCCURRENCES_PER_RUN);
      expect(series?.isActive).toBe(true);
    });

    it.each([
      {
        name: "윤년",
        startDate: "2028-02-28",
        until: "2028-03-01",
        timezone: "UTC",
        now: "2028-02-01T00:00:00Z",
        expected: [
          "2028-02-28T09:00:00.000Z",
          "2028-02-29T09:00:00.000Z",
          "2028-03-01T09:00:00.000Z",
        ],
      },
      {
        name: "31일",
        startDate: "2026-01-31",
        until: "2026-02-01",
        timezone: "Asia/Seoul",
        now: "2026-01-01T00:00:00Z",
        expected: ["2026-01-31T00:00:00.000Z", "2026-02-01T00:00:00.000Z"],
      },
      {
        name: "DST 전환",
        startDate: "2026-03-07",
        until: "2026-03-09",
        timezone: "America/New_York",
        now: "2026-03-01T00:00:00Z",
        expected: [
          "2026-03-07T14:00:00.000Z",
          "2026-03-08T13:00:00.000Z",
          "2026-03-09T13:00:00.000Z",
        ],
      },
    ])(
      "$name 회차마다 로컬 시간을 UTC로 바꾼다",
      async ({ startDate, until, timezone, now, expected }) => {
        // Given
        vi.setSystemTime(new Date(now));
        // When
        const { todos, series } = await useCase.execute(
          seriesInput({
            startDate: new Date(`${startDate}T00:00:00Z`),
            scheduledTime: "09:00",
            timezone,
            repeat: { frequency: "DAILY", end: { type: "UNTIL", date: until } },
          }),
        );
        // Then
        expect(todos.map((todo) => todo.scheduledTime)).toEqual(expected);
        expect(todos.every((todo) => !todo.isAllDay)).toBe(true);
        expect(series).toMatchObject({ scheduledLocalTime: "09:00", timezone });
      },
    );

    it("맞는 날짜가 없으면 TODO_0843이고 아무것도 저장하지 않는다", async () => {
      // Given
      const repeat = { frequency: "DAILY", end: { type: "UNTIL", date: "2026-05-17" } } as const;
      // When / Then
      await expect(useCase.execute(seriesInput({ repeat }))).rejects.toMatchObject({
        errorCode: ErrorCode.TODO_0843,
        details: { startDate: "2026-05-18", repeat },
      });
      expect(fixture.records.size).toBe(0);
      expect(fixture.seriesStore.size).toBe(0);
    });

    it("반복과 기간 종료일을 함께 보내면 TODO_0845다", async () => {
      // Given
      const endDate = new Date("2026-05-20T00:00:00Z");
      // When / Then
      await expect(useCase.execute(seriesInput({ endDate }))).rejects.toMatchObject({
        errorCode: ErrorCode.TODO_0845,
        details: { field: "endDate" },
      });
    });

    it("진행 중 규칙이 상한이면 TODO_0842이고 끝난 규칙은 세지 않는다", async () => {
      // Given
      const limit = TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER;
      for (let index = 0; index < limit; index++) {
        await useCase.execute(seriesInput({ startDate: new Date("2027-01-01T00:00:00Z") }));
      }
      const finished = { frequency: "DAILY", end: { type: "COUNT", count: 1 } } as const;
      // When / Then
      await expect(useCase.execute(seriesInput())).rejects.toMatchObject({
        errorCode: ErrorCode.TODO_0842,
        details: { limit, activeCount: limit },
      });
      for (const series of fixture.seriesStore.values()) {
        series.stopAfter("2026-12-31");
        await fixture.todoSeriesRepository.update(series);
      }
      await expect(useCase.execute(seriesInput({ repeat: finished }))).resolves.toBeDefined();
    });

    it("카테고리 한도에서 규칙은 1개로만 센다", async () => {
      // Given
      await useCase.execute(seriesInput());
      // When
      const usage = await fixture.todoRepository.countCategoryUsage(
        UserId.reconstitute(fixture.userId),
        TodoCategoryId.reconstitute(1),
      );
      // Then
      expect(usage).toBe(1);
    });

    it("카테고리가 가득 차면 TODO_0813이고 규칙을 만들지 않는다", async () => {
      // Given
      for (let id = 1; id <= TODO_LIMITS.MAX_PER_CATEGORY; id++) {
        fixture.records.set(id, createPlanningTodo(fixture.userId, id));
      }
      // When / Then
      await expect(useCase.execute(seriesInput())).rejects.toMatchObject({
        errorCode: ErrorCode.TODO_0813,
      });
      expect(fixture.seriesStore.size).toBe(0);
    });

    it("커밋 뒤 시간 있는 회차만 리마인더를 일괄 등록하고 이벤트는 규칙당 하나다", async () => {
      // Given
      const repeat = { ...WEEKDAYS_MWF, end: { type: "COUNT", count: 3 } } as const;
      // When
      const { todos, series } = await useCase.execute(
        seriesInput({ repeat, scheduledTime: "09:00" }),
      );
      // Then
      expect(fixture.todoReminder.scheduled.map((reminder) => reminder.todoId)).toEqual(
        todos.map((todo) => todo.id),
      );
      expect(
        fixture.eventPublisher.publishedEvents.map((event) => [event.eventName, event.toPayload()]),
      ).toEqual([
        [
          "planning.todo-series.occurrences-created",
          { seriesId: series?.id, userId: fixture.userId, occurredAt: expect.any(String) },
        ],
      ]);
    });

    it("종일 회차는 리마인더를 등록하지 않는다", async () => {
      // When
      await useCase.execute(
        seriesInput({ repeat: { frequency: "DAILY", end: { type: "COUNT", count: 2 } } }),
      );
      // Then
      expect(fixture.todoReminder.scheduled).toEqual([]);
    });

    it("회차 createdAt은 규칙을 만든 시각이다", async () => {
      // When
      const { todos } = await useCase.execute(
        seriesInput({ repeat: { frequency: "DAILY", end: { type: "COUNT", count: 2 } } }),
      );
      // Then
      expect(todos.map((todo) => todo.createdAt)).toEqual(
        todos.map(() => PLANNING_TIME.toISOString()),
      );
    });
  });
});
