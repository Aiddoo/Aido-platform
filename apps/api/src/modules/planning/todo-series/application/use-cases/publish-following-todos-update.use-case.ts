import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";

import { TodoSeriesLogEvent } from "../todo-series.log-events.js";
import type { AppliedFollowingEdit } from "./apply-following-todos-update.use-case.js";
import type { PublishTodoSeriesEditUseCase } from "./publish-todo-series-edit.use-case.js";

export interface PublishFollowingTodosUpdateInput {
  readonly edited: AppliedFollowingEdit;
  readonly userId: string;
}

interface PublishFollowingTodosUpdateDependencies {
  readonly effects: Pick<PublishTodoSeriesEditUseCase, "execute">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/** 이후 회차 고치기의 커밋 뒤 효과. 리마인더·이벤트는 회차와 함께 커밋됐다. */
export class PublishFollowingTodosUpdateUseCase {
  readonly #dependencies: PublishFollowingTodosUpdateDependencies;

  constructor(dependencies: PublishFollowingTodosUpdateDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: PublishFollowingTodosUpdateInput): Promise<void> {
    const { edited, userId } = input;
    await this.#dependencies.effects.execute({ seriesId: edited.target.id.value, userId });
    if (edited.isSplit) {
      this.#dependencies.logger.log({
        event: TodoSeriesLogEvent.SPLIT,
        seriesId: edited.source.id.value,
        newSeriesId: edited.target.id.value,
        userId,
      });
    }
  }
}
