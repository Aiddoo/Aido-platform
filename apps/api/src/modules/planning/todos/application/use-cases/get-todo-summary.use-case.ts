import { TODAY_SUMMARY_TOP_TODOS_MAX } from "@aido/api/vocabulary";

import { computeEffectiveStreak } from "#api/modules/identity/user-preferences/identity-user-preferences.public";
import type { CatchUpTodoSeriesUseCase } from "#api/modules/planning/todo-series/planning-todo-series.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { summarizeCompletion } from "../../domain/todo-completion.domain-service.js";
import { resolveTodoSummaryDate } from "../../domain/todo-summary-date.domain-service.js";
import { type StreakPort } from "../ports/streak.port.js";
import { type TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";

export interface GetTodoSummaryInput {
  readonly userId: string;
  /** 사용자 시간대의 오늘 */
  readonly today: Temporal.PlainDate;
  /** 요약할 날짜. 생략하면 오늘이며 오늘·내일만 허용한다. */
  readonly requestedDate?: Temporal.PlainDate;
}

interface TodoSummaryTodoResult {
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
    "getTodayTodoStats" | "listTodayTopTodos"
  >;
  readonly streakPort: Pick<StreakPort, "getStreakContext">;
  readonly seriesCatchUp: Pick<CatchUpTodoSeriesUseCase, "execute">;
}

export class GetTodoSummaryUseCase {
  readonly #dependencies: GetTodoSummaryDependencies;

  constructor(dependencies: GetTodoSummaryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetTodoSummaryInput): Promise<TodoSummaryResult> {
    const { userId } = input;
    // 내일 요약은 그날 자정에 보일 잠정 값이므로 통계와 스트릭을 모두 그 날짜 기준으로 계산한다.
    const date = resolveTodoSummaryDate(input.today, input.requestedDate);

    // 앱이 목록과 나란히 부르므로 같은 복귀를 기다려야 위젯·요약이 0개로 남지 않는다.
    await this.#dependencies.seriesCatchUp.execute(userId);

    const ownerId = UserId.reconstitute(userId);
    const [stats, topTodos, streakContext] = await Promise.all([
      this.#dependencies.todoReadRepository.getTodayTodoStats(ownerId, date),

      this.#dependencies.todoReadRepository.listTodayTopTodos(
        ownerId,
        date,
        TODAY_SUMMARY_TOP_TODOS_MAX,
      ),
      this.#dependencies.streakPort.getStreakContext(ownerId),
    ]);

    const { completionRate, isComplete } = summarizeCompletion(stats);

    const { lastCompletedDate } = streakContext;
    const { streak: currentStreak } = computeEffectiveStreak({
      currentStreak: streakContext.currentStreak,
      lastCompletedDate,
      todosCompleted: stats.completed,
      todosTotal: stats.total,
      today: date,
    });

    return {
      date: date.toString(),
      totalTodos: stats.total,
      completedTodos: stats.completed,
      completionRate,
      isComplete,
      currentStreak,
      topTodos,
    };
  }
}
