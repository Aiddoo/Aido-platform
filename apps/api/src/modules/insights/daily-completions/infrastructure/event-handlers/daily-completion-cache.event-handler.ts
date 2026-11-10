import { OnEvent } from "@nestjs/event-emitter";

import {
  TODO_CATEGORY_EVENTS,
  type TodoCategoryDeletedEvent,
  type TodoCategoryUpdatedEvent,
} from "#api/modules/planning/categories/planning-categories.public";
import {
  TODO_EVENTS,
  type TodoCategoryChangedEvent,
  type TodoCreatedEvent,
  type TodoDeletedEvent,
  type TodoOccurrencesChangedEvent,
  type TodoOccurrencesCreatedEvent,
  type TodoRescheduledEvent,
  type TodoToggledEvent,
  type TodoUpdatedEvent,
  type TodoVisibilityChangedEvent,
} from "#api/modules/planning/todos/planning-todos.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { DailyCompletionLogEvent } from "../../application/daily-completions.log-events.js";
import type { DailyCompletionCachePort } from "../../application/ports/daily-completion-cache.port.js";

type CompletionSourceChangedEvent =
  | TodoCreatedEvent
  | TodoOccurrencesCreatedEvent
  | TodoOccurrencesChangedEvent
  | TodoDeletedEvent
  | TodoToggledEvent
  | TodoRescheduledEvent
  | TodoUpdatedEvent
  | TodoCategoryChangedEvent
  | TodoVisibilityChangedEvent
  | TodoCategoryUpdatedEvent
  | TodoCategoryDeletedEvent;

export interface DailyCompletionCacheEventHandlerDependencies {
  readonly dailyCompletionCache: Pick<DailyCompletionCachePort, "invalidate">;
  readonly logger: Pick<ApplicationLoggerPort, "warn">;
}

// planning이 새 이벤트를 아직 내지 않아 옛 in-process 이벤트를 구독한다(delivery: "after-commit" 구독 전환은 후속)
export class DailyCompletionCacheEventHandler {
  readonly #dependencies: DailyCompletionCacheEventHandlerDependencies;

  constructor(dependencies: DailyCompletionCacheEventHandlerDependencies) {
    this.#dependencies = dependencies;
  }

  // 주의: @OnEvent에 배열을 넘기면 EventEmitter2가 "다중 구독"이 아니라
  // 델리미터로 결합된 단일 이벤트명으로 해석한다. 이벤트별로 데코레이터를 쌓는다.
  @OnEvent(TODO_EVENTS.CREATED)
  @OnEvent(TODO_EVENTS.OCCURRENCES_CREATED)
  @OnEvent(TODO_EVENTS.OCCURRENCES_CHANGED)
  @OnEvent(TODO_EVENTS.DELETED)
  @OnEvent(TODO_EVENTS.TOGGLED)
  @OnEvent(TODO_EVENTS.RESCHEDULED)
  @OnEvent(TODO_EVENTS.UPDATED)
  @OnEvent(TODO_EVENTS.CATEGORY_CHANGED)
  @OnEvent(TODO_EVENTS.VISIBILITY_CHANGED)
  @OnEvent(TODO_CATEGORY_EVENTS.UPDATED)
  @OnEvent(TODO_CATEGORY_EVENTS.DELETED)
  async handle(event: CompletionSourceChangedEvent): Promise<void> {
    try {
      await this.#dependencies.dailyCompletionCache.invalidate(UserId.reconstitute(event.userId));
    } catch (error) {
      this.#dependencies.logger.warn({
        event: DailyCompletionLogEvent.CACHE_INVALIDATION_FAILED,
        userId: event.userId,
        errorType: toErrorType(error),
      });
    }
  }
}
