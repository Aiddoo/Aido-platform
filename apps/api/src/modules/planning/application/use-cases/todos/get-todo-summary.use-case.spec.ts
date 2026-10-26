import { vi } from "vitest";

import {
  createPlanningTodoFixture,
  createPlanningTodo,
  PLANNING_TIME,
} from "#test/fixtures/planning-todo.fixture";

import { GetTodoSummary } from "./get-todo-summary.use-case.js";

describe("오늘의 할 일 요약", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  let useCase: GetTodoSummary;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PLANNING_TIME);
    fixture = createPlanningTodoFixture({ todos: [createPlanningTodo()] });
    useCase = new GetTodoSummary(fixture);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("통계와 가벼운 상위 목록과 스트릭을 함께 반환한다", async () => {
    // Given
    fixture.todoReadRepository.dayStats = { total: 5, completed: 3 };
    fixture.todoReadRepository.topTodos = [
      { id: 2, title: "미완료", completed: false, categoryColor: "#FFB3B3" },
      { id: 1, title: "완료", completed: true, categoryColor: "#FFB3B3" },
    ];
    fixture.streakContext.currentStreak = 12;
    const topQuery = vi.spyOn(fixture.todoReadRepository, "findTodayTopTodos");
    // When
    const result = await useCase.execute({
      userId: fixture.userId,
      today: new Date("2026-05-15T00:00:00Z"),
    });
    // Then
    expect(result).toEqual({
      date: "2026-05-15",
      totalTodos: 5,
      completedTodos: 3,
      completionRate: 60,
      isComplete: false,
      currentStreak: 12,
      topTodos: fixture.todoReadRepository.topTodos,
    });
    expect(topQuery).toHaveBeenCalledWith(fixture.userId, new Date("2026-05-15T00:00:00Z"), 10);
  });
  it.each([
    { name: "빈 목록", total: 0, completed: 0, rate: 0, complete: false },
    { name: "전체 완료", total: 4, completed: 4, rate: 100, complete: true },
    { name: "반올림", total: 3, completed: 1, rate: 33, complete: false },
  ])("$name 통계의 완료율과 완료 여부를 계산한다", async ({ total, completed, rate, complete }) => {
    // Given
    fixture.todoReadRepository.dayStats = { total, completed };
    // When
    const result = await useCase.execute({
      userId: fixture.userId,
      today: new Date("2026-05-15T00:00:00Z"),
    });
    // Then
    expect(result).toMatchObject({
      totalTodos: total,
      completedTodos: completed,
      completionRate: rate,
      isComplete: complete,
    });
  });
  it("오늘 전체 완료 직후 스트릭 쓰기가 늦어도 어제 값에서 하루를 더한다", async () => {
    // Given
    fixture.todoReadRepository.dayStats = { total: 3, completed: 3 };
    fixture.streakContext.currentStreak = 5;
    fixture.streakContext.lastCompletedDate = new Date("2026-05-14T00:00:00Z");
    // When
    const result = await useCase.execute({
      userId: fixture.userId,
      today: new Date("2026-05-15T00:00:00Z"),
    });
    // Then
    expect(result.currentStreak).toBe(6);
  });
  it("내일 요약을 요청하면 그 날짜의 통계와 자정 시점의 스트릭을 반환한다", async () => {
    // Given - 오늘 전체 완료로 스트릭이 이어진 상태
    fixture.todoReadRepository.dayStats = { total: 2, completed: 0 };
    fixture.streakContext.currentStreak = 6;
    fixture.streakContext.lastCompletedDate = new Date("2026-05-15T00:00:00Z");
    const statsQuery = vi.spyOn(fixture.todoReadRepository, "getTodayTodoStats");
    // When
    const result = await useCase.execute({
      userId: fixture.userId,
      today: new Date("2026-05-15T00:00:00Z"),
      requestedDate: new Date("2026-05-16T00:00:00Z"),
    });
    // Then
    expect(result).toMatchObject({ date: "2026-05-16", totalTodos: 2, currentStreak: 6 });
    expect(statsQuery).toHaveBeenCalledWith(fixture.userId, new Date("2026-05-16T00:00:00Z"));
  });
});
