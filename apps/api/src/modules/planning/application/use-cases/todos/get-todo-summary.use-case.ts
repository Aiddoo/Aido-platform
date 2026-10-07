import { computeEffectiveStreak } from "#api/modules/identity/identity-settings.public";
import { toDateString } from "#api/shared/domain/date/utils/format";

import { summarizeCompletion } from "../../../domain/policies/todos/completion.policy.js";
import { type StreakPort } from "../../ports/todos/streak.port.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";

const TOP_TODOS_LIMIT = 10;

export interface GetTodoSummaryInput {
  readonly userId: string;
  readonly today: Date;
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
    const { userId, today } = input;

    const [stats, topTodos, streakContext] = await Promise.all([
      this.#dependencies.todoReadRepository.getTodayTodoStats(userId, today),

      this.#dependencies.todoReadRepository.findTodayTopTodos(userId, today, TOP_TODOS_LIMIT),
      this.#dependencies.streakPort.getStreakContext(userId),
    ]);

    const { completionRate, isComplete } = summarizeCompletion(stats);

    const { streak: currentStreak } = computeEffectiveStreak({
      currentStreak: streakContext.currentStreak,
      lastCompletedDate: streakContext.lastCompletedDate,
      todosCompleted: stats.completed,
      todosTotal: stats.total,
      today,
    });

    return {
      date: toDateString(today),
      totalTodos: stats.total,
      completedTodos: stats.completed,
      completionRate,
      isComplete,
      currentStreak,
      topTodos,
    };
  }
}
