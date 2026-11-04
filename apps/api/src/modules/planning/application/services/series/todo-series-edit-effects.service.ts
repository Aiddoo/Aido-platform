import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { DomainEventPublisherPort } from "#api/shared/application/ports/index";

import { TodoOccurrencesChangedEvent } from "../../../domain/events/series/todo-occurrences-changed.event.js";
import type { TodoCachePort } from "../../ports/todos/todo-cache.port.js";

export interface TodoSeriesEditEffect {
  readonly seriesId: string;
  readonly userId: string;
  readonly events: readonly { readonly eventName: string }[];
}

interface TodoSeriesEditEffectsDependencies {
  readonly todoCache: Pick<TodoCachePort, "invalidateTodoCategories" | "invalidateFriendTodos">;
  readonly eventPublisher: DomainEventPublisherPort;
  readonly logger: Pick<ApplicationLogger, "log">;
}

/** 범위 수정·삭제의 커밋 뒤 효과. 리마인더는 UoW 안에서 처리하고 이벤트는 규칙당 하나다. */
export class TodoSeriesEditEffects {
  readonly #dependencies: TodoSeriesEditEffectsDependencies;

  constructor(dependencies: TodoSeriesEditEffectsDependencies) {
    this.#dependencies = dependencies;
  }

  async publish(effect: TodoSeriesEditEffect): Promise<void> {
    const { todoCache, eventPublisher } = this.#dependencies;
    await todoCache.invalidateTodoCategories(effect.userId);
    await todoCache.invalidateFriendTodos(effect.userId);
    await eventPublisher.publishAll([
      ...effect.events,
      new TodoOccurrencesChangedEvent(effect.seriesId, effect.userId),
    ]);
  }
}
