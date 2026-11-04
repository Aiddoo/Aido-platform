import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { DomainEventPublisherPort } from "#api/shared/application/ports/index";

import { TodoOccurrencesChangedEvent } from "../../../domain/events/series/todo-occurrences-changed.event.js";
import type { TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import type {
  TodoReminderPort,
  TodoReminderSchedule,
} from "../../ports/todos/todo-reminder.port.js";

export interface TodoSeriesEditEffect {
  readonly seriesId: string;
  readonly userId: string;
  /** 예약을 지울 회차: 지운 회차와 시각이 바뀐 회차 */
  readonly cancelledTodoIds: readonly number[];
  /** 새로 예약할 회차: 새로 만든 회차와 시각이 바뀐 회차 */
  readonly reminders: readonly TodoReminderSchedule[];
  readonly events: readonly { readonly eventName: string }[];
}

interface TodoSeriesEditEffectsDependencies {
  readonly todoCache: Pick<TodoCachePort, "invalidateTodoCategories" | "invalidateFriendTodos">;
  readonly todoReminder: Pick<TodoReminderPort, "scheduleReminders" | "cancelReminders">;
  readonly eventPublisher: DomainEventPublisherPort;
  readonly logger: Pick<ApplicationLogger, "log">;
}

/** 범위 수정·삭제의 커밋 뒤 효과. 리마인더는 취소 후 일괄 등록하고 이벤트는 규칙당 하나다. */
export class TodoSeriesEditEffects {
  readonly #dependencies: TodoSeriesEditEffectsDependencies;

  constructor(dependencies: TodoSeriesEditEffectsDependencies) {
    this.#dependencies = dependencies;
  }

  async publish(effect: TodoSeriesEditEffect): Promise<void> {
    const { todoCache, todoReminder, eventPublisher } = this.#dependencies;
    await todoCache.invalidateTodoCategories(effect.userId);
    await todoCache.invalidateFriendTodos(effect.userId);
    await todoReminder.cancelReminders(effect.cancelledTodoIds);
    await todoReminder.scheduleReminders(effect.reminders);
    await eventPublisher.publishAll([
      ...effect.events,
      new TodoOccurrencesChangedEvent(effect.seriesId, effect.userId),
    ]);
  }
}
