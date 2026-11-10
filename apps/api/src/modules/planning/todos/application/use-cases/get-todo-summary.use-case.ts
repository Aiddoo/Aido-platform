import { computeEffectiveStreak } from "#api/modules/identity/identity-settings.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { plainDateToDate } from "#api/shared/domain/time/plain-date";

import type { CatchUpTodoSeriesUseCase } from "../../../todo-series/application/use-cases/catch-up-todo-series.use-case.js";
import { summarizeCompletion } from "../../domain/todo-completion.domain-service.js";
import { resolveTodoSummaryDate } from "../../domain/todo-summary-date.domain-service.js";
import { type StreakPort } from "../ports/streak.port.js";
import { type TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";

const TOP_TODOS_LIMIT = 10;

export interface GetTodoSummaryInput {
  readonly userId: string;
  /** 사용자 시간대의 오늘 */
  readonly today: Temporal.PlainDate;
  /** 요약할 날짜. 생략하면 오늘이며 오늘·내일만 허용한다. */
  readonly requestedDate?: Temporal.PlainDate;
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

      this.#dependencies.todoReadRepository.findTodayTopTodos(ownerId, date, TOP_TODOS_LIMIT),
      this.#dependencies.streakPort.getStreakContext(ownerId),
    ]);

    const { completionRate, isComplete } = summarizeCompletion(stats);

    const { lastCompletedDate } = streakContext;
    // identity의 스트릭 판정은 아직 UTC 자정 Date로 계산한다
    const { streak: currentStreak } = computeEffectiveStreak({
      currentStreak: streakContext.currentStreak,
      lastCompletedDate: lastCompletedDate == null ? null : plainDateToDate(lastCompletedDate),
      todosCompleted: stats.completed,
      todosTotal: stats.total,
      today: plainDateToDate(date),
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
