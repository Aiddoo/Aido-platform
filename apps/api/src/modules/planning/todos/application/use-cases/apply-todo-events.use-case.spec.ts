import type { PublishedDomainEvent } from "#api/shared/application/ports/domain-event-publisher.port";
import { RecordingTodoReminderScheduler } from "#test/doubles/planning/recording-todo-reminder-scheduler";
import { FixedClock } from "#test/doubles/platform/fixed-clock";

import { TodoCreatedEvent } from "../../../shared/domain/todo-created.event.js";
import { TodoDeletedEvent } from "../../../shared/domain/todo-deleted.event.js";
import { TodoRescheduledEvent } from "../../../shared/domain/todo-rescheduled.event.js";
import { TodoToggledEvent } from "../../../shared/domain/todo-toggled.event.js";
import { TodoUpdatedEvent } from "../../../shared/domain/todo-updated.event.js";
import { TodoOccurrencesCreatedEvent } from "../../../todo-series/domain/todo-occurrences-created.event.js";
import {
  todoChangedPayloadSchema,
  todoSeriesChangedPayloadSchema,
} from "../../planning-todos.public.js";
import { ApplyTodoEventsUseCase } from "./apply-todo-events.use-case.js";

const AT = Temporal.Instant.from("2026-11-10T00:00:00Z");
const TEN_AM = Temporal.Instant.from("2026-11-11T01:00:00.000Z");

function createUseCase() {
  const reminders = new RecordingTodoReminderScheduler();
  const published: PublishedDomainEvent[] = [];
  const useCase = new ApplyTodoEventsUseCase({
    reminderScheduler: reminders,
    eventPublisher: {
      publish: async (events) => {
        published.push(...events);
      },
    },
    clock: new FixedClock(AT),
  });
  return { useCase, reminders, published };
}

describe("ApplyTodoEventsUseCase — 트랜잭션 안 리마인더·이벤트", () => {
  it.each([
    {
      label: "시각 있는 생성은 예약한다",
      event: new TodoCreatedEvent(1, "user-1", TEN_AM),
      scheduled: [1],
      cancelled: [],
      eventName: "planning.todo.created",
    },
    {
      label: "종일 생성은 예약하지 않는다",
      event: new TodoCreatedEvent(1, "user-1", null),
      scheduled: [],
      cancelled: [],
      eventName: "planning.todo.created",
    },
    {
      label: "새 시각으로 옮기면 다시 예약한다",
      event: new TodoRescheduledEvent(1, "user-1", TEN_AM),
      scheduled: [1],
      cancelled: [],
      eventName: "planning.todo.rescheduled",
    },
    {
      label: "시각을 지우면 예약을 취소한다",
      event: new TodoRescheduledEvent(1, "user-1", null),
      scheduled: [],
      cancelled: [1],
      eventName: "planning.todo.rescheduled",
    },
    {
      label: "완료하면 예약을 취소한다",
      event: new TodoToggledEvent(1, "user-1", true, "Asia/Seoul"),
      scheduled: [],
      cancelled: [1],
      eventName: "planning.todo.completed",
    },
    {
      label: "완료를 되돌리면 이 이벤트로는 예약하지 않는다(시각은 rescheduled가 다시 잡는다)",
      event: new TodoToggledEvent(1, "user-1", false, "Asia/Seoul"),
      scheduled: [],
      cancelled: [],
      eventName: "planning.todo.reopened",
    },
    {
      label: "완료 상태로 수정하면 예약을 취소한다",
      event: new TodoUpdatedEvent(1, "user-1", true),
      scheduled: [],
      cancelled: [1],
      eventName: "planning.todo.updated",
    },
    {
      label: "삭제하면 예약을 취소한다",
      event: new TodoDeletedEvent(1, "user-1"),
      scheduled: [],
      cancelled: [1],
      eventName: "planning.todo.deleted",
    },
  ])("$label", async ({ event, scheduled, cancelled, eventName }) => {
    // Given
    const { useCase, reminders, published } = createUseCase();

    // When
    await useCase.execute([event]);

    // Then
    expect(reminders.scheduled.map(({ todoId }) => todoId)).toEqual(scheduled);
    expect(reminders.cancelled).toEqual(cancelled);
    expect(published.map((fact) => fact.eventName)).toEqual([eventName]);
    expect(todoChangedPayloadSchema.parse(published[0]?.toPayload())).toEqual({
      todoId: 1,
      userId: "user-1",
      occurredAt: "2026-11-10T00:00:00.000Z",
    });
  });

  it("회차 생성은 규칙당 한 이벤트로 알리고 구독 schema와 같은 모양이다", async () => {
    // Given
    const { useCase, published } = createUseCase();

    // When
    await useCase.execute([new TodoOccurrencesCreatedEvent("series-1", "user-1", 90)]);

    // Then
    expect(published.map((fact) => fact.eventName)).toEqual([
      "planning.todo-series.occurrences-created",
    ]);
    expect(todoSeriesChangedPayloadSchema.parse(published[0]?.toPayload())).toEqual({
      seriesId: "series-1",
      userId: "user-1",
      occurredAt: "2026-11-10T00:00:00.000Z",
    });
  });

  it("알릴 사실이 없으면 publish를 부르지 않는다", async () => {
    // Given
    const { useCase, published } = createUseCase();

    // When
    await useCase.execute([]);

    // Then
    expect(published).toEqual([]);
  });
});
