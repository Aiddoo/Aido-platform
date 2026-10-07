import { ErrorCode } from "@aido/api/errors";
import { TODO_LIMITS } from "@aido/api/vocabulary";
import { vi } from "vitest";

import {
  createPlanningTodoFixture,
  createPlanningTodo,
  PLANNING_TIME,
} from "#test/fixtures/planning-todo.fixture";

import { TodoCreatedEvent } from "../../../domain/events/todos/todo-created.event.js";
import type { CreateRecurringTodoData } from "../../models/todos/todo.types.js";
import { TodoCreationEffects } from "../../services/todos/todo-creation-effects.service.js";
import { TodoCreationWriter } from "../../services/todos/todo-creation-writer.service.js";
import { CreateRecurringTodos } from "./create-recurring-todos.use-case.js";

describe("반복 할 일 생성", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  let useCase: CreateRecurringTodos;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PLANNING_TIME);
    fixture = createPlanningTodoFixture({ todos: [createPlanningTodo()] });
    useCase = new CreateRecurringTodos({
      ...fixture,
      writer: new TodoCreationWriter(fixture),
      effects: new TodoCreationEffects(fixture),
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("선택한 요일에 연속 순서와 하위 항목을 저장하고 같은 그룹 응답을 반환한다", async () => {
    // Given
    fixture.records.clear();
    const data: CreateRecurringTodoData = {
      userId: fixture.userId,
      title: "반복 할 일",
      categoryId: 1,
      startDate: "2026-03-02",
      endDate: "2026-03-08",
      daysOfWeek: ["MON", "WED", "FRI"],
      items: [{ title: "준비" }, { title: "실행" }],
    };
    // When
    const result = await useCase.execute({ data, timezone: "Asia/Seoul" });
    // Then
    expect(result.count).toBe(3);
    expect(result.todos.map((todo) => [todo.startDate, todo.sortOrder])).toEqual([
      ["2026-03-02", 0],
      ["2026-03-04", 1],
      ["2026-03-06", 2],
    ]);
    expect(new Set(result.todos.map((todo) => todo.recurrenceGroupId)).size).toBe(1);
    expect(
      result.todos.every(
        (todo) => typeof todo.recurrenceGroupId === "string" && todo.items.length === 2,
      ),
    ).toBe(true);
    expect(fixture.records.size).toBe(3);
    expect(fixture.eventPublisher.events).toEqual(
      result.todos.map((todo) => new TodoCreatedEvent(todo.id, fixture.userId, null)),
    );
  });
  it.each([
    {
      name: "윤년",
      startDate: "2028-02-28",
      endDate: "2028-03-01",
      timezone: "UTC",
      expected: [
        "2028-02-28T09:00:00.000Z",
        "2028-02-29T09:00:00.000Z",
        "2028-03-01T09:00:00.000Z",
      ],
    },
    {
      name: "31일",
      startDate: "2026-01-31",
      endDate: "2026-02-01",
      timezone: "Asia/Seoul",
      expected: ["2026-01-31T00:00:00.000Z", "2026-02-01T00:00:00.000Z"],
    },
    {
      name: "DST 전환",
      startDate: "2026-03-07",
      endDate: "2026-03-09",
      timezone: "America/New_York",
      expected: [
        "2026-03-07T14:00:00.000Z",
        "2026-03-08T13:00:00.000Z",
        "2026-03-09T13:00:00.000Z",
      ],
    },
  ])(
    "$name 날짜마다 로컬 시간을 UTC로 변환한다",
    async ({ startDate, endDate, timezone, expected }) => {
      // Given
      fixture.records.clear();
      const data: CreateRecurringTodoData = {
        userId: fixture.userId,
        title: "반복",
        categoryId: 1,
        startDate,
        endDate,
        daysOfWeek: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
        scheduledTime: "09:00",
      };
      // When
      const result = await useCase.execute({ data, timezone });
      // Then
      expect(result.todos.map((todo) => todo.scheduledTime)).toEqual(expected);
      expect(fixture.eventPublisher.events).toHaveLength(expected.length);
    },
  );
  it("선택된 날짜가 없거나 최대 인스턴스를 초과하면 쓰지 않는다", async () => {
    // Given
    const data: CreateRecurringTodoData = {
      userId: fixture.userId,
      title: "반복",
      categoryId: 1,
      startDate: "2026-03-02",
      endDate: "2026-03-02",
      daysOfWeek: ["SUN"],
    };
    const before = structuredClone([...fixture.records.values()]);
    // When / Then
    await expect(useCase.execute({ data, timezone: "UTC" })).rejects.toMatchObject({
      errorCode: ErrorCode.SYS_0002,
    });
    await expect(
      useCase.execute({
        data: {
          ...data,
          startDate: "2026-01-01",
          endDate: "2028-12-31",
          daysOfWeek: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
        },
        timezone: "UTC",
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0812 });
    expect([...fixture.records.values()]).toEqual(before);
  });
  it("그룹 전체가 활성 한도를 넘으면 생성하지 않는다", async () => {
    // Given
    for (let id = 2; id <= TODO_LIMITS.MAX_PER_CATEGORY - 2; id++)
      fixture.records.set(id, createPlanningTodo(fixture.userId, id));
    const count = fixture.records.size;
    const data: CreateRecurringTodoData = {
      userId: fixture.userId,
      title: "반복",
      categoryId: 1,
      startDate: "2026-03-02",
      endDate: "2026-03-08",
      daysOfWeek: ["MON", "WED", "FRI"],
    };
    // When / Then
    await expect(useCase.execute({ data, timezone: "UTC" })).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_0813,
    });
    expect(fixture.records.size).toBe(count);
    expect(fixture.eventPublisher.events).toEqual([]);
  });

  it("이벤트 발행이 끝나기 전에 응답 조회를 진행하지 않는다", async () => {
    // Given
    const entered = Promise.withResolvers<void>();
    const publication = Promise.withResolvers<void>();
    fixture.eventPublisher.publishAll = async () => {
      entered.resolve();
      await publication.promise;
    };
    const responseRead = vi.spyOn(fixture.todoReadRepository, "findManyByRecurrenceGroupId");
    // When
    const execution = useCase.execute({
      data: {
        userId: fixture.userId,
        title: "반복",
        categoryId: 1,
        startDate: "2026-03-02",
        endDate: "2026-03-02",
        daysOfWeek: ["MON"],
      },
      timezone: "UTC",
    });
    try {
      await Promise.race([entered.promise, execution]);
      // Then
      expect(responseRead).not.toHaveBeenCalled();
    } finally {
      publication.resolve();
      await execution;
    }
    expect(responseRead).toHaveBeenCalledOnce();
  });
  it.each(["cache", "publisher"])(
    "단독 생성의 %s 실패는 원래 오류를 전달하고 응답 조회를 시작하지 않는다",
    async (boundary) => {
      // Given
      fixture.records.clear();
      const failure = new Error(`${boundary} failure`);
      if (boundary === "cache")
        fixture.todoCache.invalidateTodoCategories = async () => {
          throw failure;
        };
      else
        fixture.eventPublisher.publishAll = async () => {
          throw failure;
        };
      const responseRead = vi.spyOn(fixture.todoReadRepository, "findManyByRecurrenceGroupId");
      // When / Then
      await expect(
        useCase.execute({
          data: {
            userId: fixture.userId,
            title: "반복",
            categoryId: 1,
            startDate: "2026-03-02",
            endDate: "2026-03-02",
            daysOfWeek: ["MON"],
          },
          timezone: "UTC",
        }),
      ).rejects.toBe(failure);
      expect(fixture.records.size).toBe(1);
      expect(responseRead).not.toHaveBeenCalled();
    },
  );
});
