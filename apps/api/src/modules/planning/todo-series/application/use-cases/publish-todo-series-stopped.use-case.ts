import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";

import { TodoSeriesLogEvent } from "../todo-series.log-events.js";
import type { PublishTodoSeriesEditUseCase } from "./publish-todo-series-edit.use-case.js";
import type { StoppedSeries } from "./stop-todo-series.use-case.js";

interface PublishTodoSeriesStoppedDependencies {
  readonly effects: Pick<PublishTodoSeriesEditUseCase, "execute">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/** 반복 끝내기의 커밋 뒤 효과. 리마인더·이벤트는 회차 삭제와 함께 커밋됐다. */
export class PublishTodoSeriesStoppedUseCase {
  readonly #dependencies: PublishTodoSeriesStoppedDependencies;

  constructor(dependencies: PublishTodoSeriesStoppedDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(stopped: StoppedSeries): Promise<void> {
    const { series, userId, deletedTodoIds } = stopped;
    await this.#dependencies.effects.execute({ seriesId: series.id.value, userId });
    this.#dependencies.logger.log({
      event: TodoSeriesLogEvent.STOPPED,
      seriesId: series.id.value,
      userId,
      deletedCount: deletedTodoIds.length,
    });
  }
}
