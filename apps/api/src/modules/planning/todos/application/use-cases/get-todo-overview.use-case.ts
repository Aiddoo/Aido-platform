import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoSeriesRepositoryPort } from "../../../todo-series/application/ports/todo-series.repository.port.js";
import type { CatchUpTodoSeriesUseCase } from "../../../todo-series/application/use-cases/catch-up-todo-series.use-case.js";
import type { TodoReadRepositoryPort } from "../ports/todo-read.repository.port.js";

export interface GetTodoOverviewInput {
  readonly userId: string;
}

export interface TodoOverviewResult {
  readonly hasTodo: boolean;
  readonly hasCompletedTodo: boolean;
  readonly hasActiveRepeat: boolean;
}

interface GetTodoOverviewDependencies {
  readonly todoReadRepository: Pick<
    TodoReadRepositoryPort,
    "existsByUserId" | "existsCompletedByUserId"
  >;
  readonly seriesRepository: Pick<TodoSeriesRepositoryPort, "existsActiveByUserId">;
  readonly seriesCatchUp: Pick<CatchUpTodoSeriesUseCase, "execute">;
}

export class GetTodoOverviewUseCase {
  readonly #dependencies: GetTodoOverviewDependencies;

  constructor(dependencies: GetTodoOverviewDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetTodoOverviewInput): Promise<TodoOverviewResult> {
    // 휴면 중에 종료일·횟수가 지난 규칙은 복귀 처리가 끝내므로, 먼저 기다려야 끝난 반복을 진행 중으로 답하지 않는다
    await this.#dependencies.seriesCatchUp.execute(input.userId);

    const ownerId = UserId.reconstitute(input.userId);
    const [hasTodo, hasCompletedTodo, hasActiveRepeat] = await Promise.all([
      this.#dependencies.todoReadRepository.existsByUserId(ownerId),
      this.#dependencies.todoReadRepository.existsCompletedByUserId(ownerId),
      this.#dependencies.seriesRepository.existsActiveByUserId(ownerId),
    ]);

    return { hasTodo, hasCompletedTodo, hasActiveRepeat };
  }
}
