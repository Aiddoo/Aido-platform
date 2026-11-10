import { Inject, Injectable, Logger } from "@nestjs/common";
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
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { InsightsLogEvent } from "../../application/daily-completions.log-events.js";
import {
  DAILY_COMPLETION_CACHE,
  type DailyCompletionCachePort,
} from "../../application/ports/daily-completion-cache.port.js";

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

@Injectable()
export class DailyCompletionCacheInvalidator {
  readonly #logger = new Logger(DailyCompletionCacheInvalidator.name);

  readonly #cache: DailyCompletionCachePort;

  constructor(@Inject(DAILY_COMPLETION_CACHE) cache: DailyCompletionCachePort) {
    this.#cache = cache;
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
      await this.#cache.invalidate(event.userId);
    } catch (error) {
      this.#logger.warn({
        event: InsightsLogEvent.DAILY_COMPLETION_CACHE_INVALIDATION_FAILED,
        userId: event.userId,
        errorType: toErrorType(error),
      });
    }
  }
}
