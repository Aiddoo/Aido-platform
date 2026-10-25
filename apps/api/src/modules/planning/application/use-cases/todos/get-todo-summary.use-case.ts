import { computeEffectiveStreak } from "#api/modules/identity/identity-settings.public";
import { toDateString } from "#api/shared/domain/date/utils/format";

import { summarizeCompletion } from "../../../domain/policies/todos/completion.policy.js";
import { resolveTodoSummaryDate } from "../../../domain/policies/todos/todo-summary-date.policy.js";
import { type StreakPort } from "../../ports/todos/streak.port.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";

const TOP_TODOS_LIMIT = 10;

export interface GetTodoSummaryInput {
  readonly userId: string;
  /** 사용자 시간대의 오늘 (UTC 자정 DATE) */
  readonly today: Date;
  /** 요약할 날짜. 생략하면 오늘이며 오늘·내일만 허용한다. */
  readonly requestedDate?: Date;
}

export interface TodoSummaryTodoResult {
  readonly id: number;
  readonly title: string;
  readonly completed: boolean;
  readonly categoryColor: string;
}

export interface TodoSummaryResult {
  readonly date: string;
  readonly totalTodos: number;
  readonly completedTodos: number;
  readonly completionRate: number;
  readonly isComplete: boolean;
  readonly currentStreak: number;
  readonly topTodos: TodoSummaryTodoResult[];
}

interface GetTodoSummaryDependencies {
  readonly todoReadRepository: Pick<
    TodoReadRepositoryPort,
    "getTodayTodoStats" | "findTodayTopTodos"
  >;
  readonly streakPort: Pick<StreakPort, "getStreakContext">;
}

export class GetTodoSummary {
  readonly #dependencies: GetTodoSummaryDependencies;

  constructor(dependencies: GetTodoSummaryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetTodoSummaryInput): Promise<TodoSummaryResult> {
    const { userId } = input;
    // 내일 요약은 그날 자정에 보일 잠정 값이므로 통계와 스트릭을 모두 그 날짜 기준으로 계산한다.
    const date = resolveTodoSummaryDate(input.today, input.requestedDate);

    const [stats, topTodos, streakContext] = await Promise.all([
      this.#dependencies.todoReadRepository.getTodayTodoStats(userId, date),

      this.#dependencies.todoReadRepository.findTodayTopTodos(userId, date, TOP_TODOS_LIMIT),
      this.#dependencies.streakPort.getStreakContext(userId),
    ]);

    const { completionRate, isComplete } = summarizeCompletion(stats);

    const { streak: currentStreak } = computeEffectiveStreak({
      currentStreak: streakContext.currentStreak,
      lastCompletedDate: streakContext.lastCompletedDate,
      todosCompleted: stats.completed,
      todosTotal: stats.total,
      today: date,
    });

    return {
      date: toDateString(date),
      totalTodos: stats.total,
      completedTodos: stats.completed,
      completionRate,
      isComplete,
      currentStreak,
      topTodos,
    };
  }
}
