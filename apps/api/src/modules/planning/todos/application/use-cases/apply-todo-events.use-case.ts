import { randomUUID } from "node:crypto";

import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { DomainEventPublisherPort } from "#api/shared/application/ports/domain-event-publisher.port";
import type { DomainEvent } from "#api/shared/domain/model/domain-event";

import { TodoCategoryChangedEvent } from "../../../shared/domain/todo-category-changed.event.js";
import {
  TodoChangedEvent,
  type TodoChangeEventName,
} from "../../../shared/domain/todo-changed.event.js";
import { TodoCreatedEvent } from "../../../shared/domain/todo-created.event.js";
import { TodoDeletedEvent } from "../../../shared/domain/todo-deleted.event.js";
import { TodoRescheduledEvent } from "../../../shared/domain/todo-rescheduled.event.js";
import {
  TodoSeriesChangedEvent,
  type TodoSeriesChangeEventName,
} from "../../../shared/domain/todo-series-changed.event.js";
import { TodoToggledEvent } from "../../../shared/domain/todo-toggled.event.js";
import { TodoUpdatedEvent } from "../../../shared/domain/todo-updated.event.js";
import { TodoVisibilityChangedEvent } from "../../../shared/domain/todo-visibility-changed.event.js";
import { TodoOccurrencesChangedEvent } from "../../../todo-series/domain/todo-occurrences-changed.event.js";
import { TodoOccurrencesCreatedEvent } from "../../../todo-series/domain/todo-occurrences-created.event.js";
import type { TodoReminderSchedulerPort } from "../ports/todo-reminder-scheduler.port.js";

type PublishedTodoEvent = TodoChangedEvent | TodoSeriesChangedEvent;

export interface ApplyTodoEventsDependencies {
  readonly reminderScheduler: Pick<
    TodoReminderSchedulerPort,
    "scheduleReminder" | "cancelReminders"
  >;
  readonly eventPublisher: Pick<DomainEventPublisherPort, "publish">;
  readonly clock: ClockPort;
}

/**
 * Aggregate가 낸 사실을 같은 트랜잭션의 후속 작업으로 바꾼다. 활성 UoW 안에서 부른다.
 * - 리마인더: 예약·취소를 여기서 한다. 실패하면 할 일 변경도 롤백된다
 * - 다른 Context: planning.* 이벤트를 구독 큐 작업·커밋 뒤 전달로 함께 등록한다
 */
export class ApplyTodoEventsUseCase {
  readonly #dependencies: ApplyTodoEventsDependencies;

  constructor(dependencies: ApplyTodoEventsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(events: readonly DomainEvent[]): Promise<void> {
    const occurredAt = this.#dependencies.clock.now();
    const published: PublishedTodoEvent[] = [];
    for (const event of events) {
      await this.#applyReminder(event);
      const fact = toPublishedEvent(event, occurredAt);
      if (fact != null) {
        published.push(fact);
      }
    }
    if (published.length > 0) {
      await this.#dependencies.eventPublisher.publish(published);
    }
  }

  async #applyReminder(event: DomainEvent): Promise<void> {
    const { reminderScheduler } = this.#dependencies;
    if (event instanceof TodoCreatedEvent && event.scheduledTime != null) {
      await reminderScheduler.scheduleReminder(event.todoId, event.scheduledTime, event.userId);
      return;
    }
    if (event instanceof TodoRescheduledEvent) {
      if (event.scheduledTime == null) {
        await reminderScheduler.cancelReminders([event.todoId]);
        return;
      }
      await reminderScheduler.scheduleReminder(event.todoId, event.scheduledTime, event.userId);
      return;
    }
    const cancels =
      event instanceof TodoDeletedEvent ||
      (event instanceof TodoToggledEvent && event.completed) ||
      (event instanceof TodoUpdatedEvent && event.completed);
    if (cancels) {
      await reminderScheduler.cancelReminders([event.todoId]);
    }
  }
}

function todoFact(
  eventName: TodoChangeEventName,
  event: { readonly todoId: number; readonly userId: string },
  occurredAt: Temporal.Instant,
): TodoChangedEvent {
  return new TodoChangedEvent({
    eventName,
    eventId: randomUUID(),
    occurredAt,
    todoId: event.todoId,
    userId: event.userId,
  });
}

function seriesFact(
  eventName: TodoSeriesChangeEventName,
  event: { readonly seriesId: string; readonly userId: string },
  occurredAt: Temporal.Instant,
): TodoSeriesChangedEvent {
  return new TodoSeriesChangedEvent({
    eventName,
    eventId: randomUUID(),
    occurredAt,
    seriesId: event.seriesId,
    userId: event.userId,
  });
}

function toPublishedEvent(
  event: DomainEvent,
  occurredAt: Temporal.Instant,
): PublishedTodoEvent | null {
  if (event instanceof TodoCreatedEvent) {
    return todoFact("planning.todo.created", event, occurredAt);
  }
  if (event instanceof TodoUpdatedEvent) {
    return todoFact("planning.todo.updated", event, occurredAt);
  }
  if (event instanceof TodoToggledEvent) {
    return todoFact(
      event.completed ? "planning.todo.completed" : "planning.todo.reopened",
      event,
      occurredAt,
    );
  }
  if (event instanceof TodoRescheduledEvent) {
    return todoFact("planning.todo.rescheduled", event, occurredAt);
  }
  if (event instanceof TodoCategoryChangedEvent) {
    return todoFact("planning.todo.category-changed", event, occurredAt);
  }
  if (event instanceof TodoVisibilityChangedEvent) {
    return todoFact("planning.todo.visibility-changed", event, occurredAt);
  }
  if (event instanceof TodoDeletedEvent) {
    return todoFact("planning.todo.deleted", event, occurredAt);
  }
  if (event instanceof TodoOccurrencesCreatedEvent) {
    return seriesFact("planning.todo-series.occurrences-created", event, occurredAt);
  }
  if (event instanceof TodoOccurrencesChangedEvent) {
    return seriesFact("planning.todo-series.occurrences-changed", event, occurredAt);
  }
  return null;
}
