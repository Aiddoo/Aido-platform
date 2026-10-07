import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createStreakMock, createTodoReadRepositoryMock } from "#test/mocks/ports/index";

import { type StreakPort } from "../../ports/todos/streak.port.js";
import {
  type TodaySummaryTodoRow,
  type TodoReadRepositoryPort,
} from "../../ports/todos/todo-read.repository.port.js";
import { GetTodoSummary } from "./get-todo-summary.use-case.js";

function buildRow(id: number, completed: boolean, title = `할 일 ${id}`): TodaySummaryTodoRow {
  return { id, title, completed, categoryColor: "#FFB3B3" };
}

describe("GetTodoSummary — 오늘의 할 일 요약 조회 (홈 위젯용)", () => {
  let useCase: GetTodoSummary;
  let todoReadRepository: Mocked<TodoReadRepositoryPort>;
  let streakPort: Mocked<StreakPort>;

  const today = new Date("2026-07-12T00:00:00.000Z");
  const baseInput = { userId: "user-123", today };

  beforeEach(async () => {
    const getTodoSummaryDependencies = mockDeep<ConstructorParameters<typeof GetTodoSummary>[0]>({
      todoReadRepository: createTodoReadRepositoryMock(),
      streakPort: createStreakMock(),
    });
    const unit = new GetTodoSummary(getTodoSummaryDependencies);

    useCase = unit;
    todoReadRepository = getTodoSummaryDependencies.todoReadRepository;
    streakPort = getTodoSummaryDependencies.streakPort;
  });

  it("오늘 통계·상위 할 일·스트릭을 합성해 요약을 반환한다", async () => {
    // Given
    todoReadRepository.getTodayTodoStats.mockResolvedValue({
      total: 5,
      completed: 3,
    });
    todoReadRepository.findTodayTopTodos.mockResolvedValue([buildRow(2, false), buildRow(1, true)]);
    streakPort.getStreakContext.mockResolvedValue({
      currentStreak: 12,
      lastCompletedDate: null,
    });

    // When
    const result = await useCase.execute(baseInput);

    // Then
    expect(result).toEqual({
      date: "2026-07-12",
      totalTodos: 5,
      completedTodos: 3,
      completionRate: 60,
      isComplete: false,
      currentStreak: 12,
      // 저장소가 내려준 순서(미완료 우선)를 그대로 보존한다
      topTodos: [
        {
          id: 2,
          title: expect.any(String),
          completed: false,
          categoryColor: "#FFB3B3",
        },
        {
          id: 1,
          title: expect.any(String),
          completed: true,
          categoryColor: "#FFB3B3",
        },
      ],
    });
  });

  it("상위 할 일은 위젯 전용 쿼리로 오늘 날짜 기준 최대 10개만 조회한다", async () => {
    // Given
    todoReadRepository.getTodayTodoStats.mockResolvedValue({
      total: 0,
      completed: 0,
    });
    todoReadRepository.findTodayTopTodos.mockResolvedValue([]);
    streakPort.getStreakContext.mockResolvedValue({
      currentStreak: 0,
      lastCompletedDate: null,
    });

    // When
    await useCase.execute(baseInput);

    // Then - 정렬(미완료 우선)은 저장소 쿼리가 소유한다
    expect(todoReadRepository.findTodayTopTodos).toHaveBeenCalledWith("user-123", today, 10);
  });

  it("할 일이 없는 날은 완료율 0, isComplete false다 (total=0 엣지)", async () => {
    // Given
    todoReadRepository.getTodayTodoStats.mockResolvedValue({
      total: 0,
      completed: 0,
    });
    todoReadRepository.findTodayTopTodos.mockResolvedValue([]);
    streakPort.getStreakContext.mockResolvedValue({
      currentStreak: 3,
      lastCompletedDate: null,
    });

    // When
    const result = await useCase.execute(baseInput);

    // Then
    expect(result.totalTodos).toBe(0);
    expect(result.completionRate).toBe(0);
    expect(result.isComplete).toBe(false);
    expect(result.topTodos).toEqual([]);
  });

  it("전부 완료한 날은 완료율 100, isComplete true다", async () => {
    // Given
    todoReadRepository.getTodayTodoStats.mockResolvedValue({
      total: 4,
      completed: 4,
    });
    todoReadRepository.findTodayTopTodos.mockResolvedValue([]);
    streakPort.getStreakContext.mockResolvedValue({
      currentStreak: 1,
      lastCompletedDate: today,
    });

    // When
    const result = await useCase.execute(baseInput);

    // Then
    expect(result.completionRate).toBe(100);
    expect(result.isComplete).toBe(true);
  });

  it("전체 완료 직후 스트릭 쓰기가 미착지여도 effective streak(+1)을 반환한다 (레이스)", async () => {
    // Given - 어제까지 5연속, 오늘 전체 완료했지만 fire-and-forget 스트릭 쓰기 전
    const yesterday = new Date("2026-07-11T00:00:00.000Z");
    todoReadRepository.getTodayTodoStats.mockResolvedValue({
      total: 3,
      completed: 3,
    });
    todoReadRepository.findTodayTopTodos.mockResolvedValue([]);
    streakPort.getStreakContext.mockResolvedValue({
      currentStreak: 5,
      lastCompletedDate: yesterday,
    });

    // When
    const result = await useCase.execute(baseInput);

    // Then - 스케줄러와 동일한 도메인 판정(computeEffectiveStreak)으로 +1
    expect(result.currentStreak).toBe(6);
  });

  it("완료율은 daily-completion 규칙대로 반올림한다 (1/3 → 33)", async () => {
    // Given
    todoReadRepository.getTodayTodoStats.mockResolvedValue({
      total: 3,
      completed: 1,
    });
    todoReadRepository.findTodayTopTodos.mockResolvedValue([]);
    streakPort.getStreakContext.mockResolvedValue({
      currentStreak: 0,
      lastCompletedDate: null,
    });

    // When
    const result = await useCase.execute(baseInput);

    // Then
    expect(result.completionRate).toBe(33);
  });
});
