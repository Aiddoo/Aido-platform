import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { type MutationLockPort, type UnitOfWorkPort } from "#api/shared/application/ports/index";

import { TodoLockKeys } from "../../../todos/application/todos.lock-keys.js";
import type {
  TodoSeriesRef,
  TodoSeriesRepositoryPort,
} from "../ports/todo-series.repository.port.js";
import type { MaterializeTodoOccurrencesUseCase } from "./materialize-todo-occurrences.use-case.js";
import type { PublishTodoCreationUseCase } from "./publish-todo-creation.use-case.js";

interface TodoSeriesDueRunnerDependencies {
  readonly seriesRepository: Pick<TodoSeriesRepositoryPort, "lockForUpdate" | "update">;
  readonly materializer: Pick<MaterializeTodoOccurrencesUseCase, "planDueRun" | "persist">;
  readonly effects: Pick<PublishTodoCreationUseCase, "publishOccurrences">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly clock: ClockPort;
}

/** 규칙 하나를 지금 시각까지 채운다. 밤 작업과 복귀 경로가 같은 잠금 순서·저장 규칙을 쓴다. */
export class MaterializeTodoSeriesUseCase {
  readonly #dependencies: TodoSeriesDueRunnerDependencies;

  constructor(dependencies: TodoSeriesDueRunnerDependencies) {
    this.#dependencies = dependencies;
  }

  /** 만든 회차 수를 돌려준다. skipLocked면 다른 트랜잭션이 잡은 규칙을 기다리지 않는다. */
  async execute(due: TodoSeriesRef, options: { readonly skipLocked: boolean }): Promise<number> {
    const { unitOfWork, seriesRepository, mutationLock, materializer, effects } =
      this.#dependencies;
    const materialized = await unitOfWork.run(async () => {
      // 카테고리 삭제와 같은 순서(잠금 → 규칙 행)로 잡아 교착을 막는다.
      await mutationLock.acquire([TodoLockKeys.sortOrder(due.userId)]);
      const series = await seriesRepository.lockForUpdate(due.id, options);
      if (series == null) {
        return null;
      }
      const cursorBefore = series.nextOccurrenceDate;
      const drafts = materializer.planDueRun(series, this.#dependencies.clock.now());
      if (series.nextOccurrenceDate === cursorBefore) {
        return null;
      }
      const occurrences = await materializer.persist(series, drafts);
      await seriesRepository.update(series);
      return { series, occurrences };
    });
    if (materialized == null || materialized.occurrences.length === 0) {
      return 0;
    }
    // 회차·리마인더·이벤트는 이미 커밋됐다. 캐시 정리가 실패하면 호출자가 이 규칙만 실패로 센다.
    await effects.publishOccurrences(materialized.series);
    return materialized.occurrences.length;
  }
}
