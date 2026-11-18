import { toIsoString } from "#api/shared/domain/time/instant";

import {
  type TodoChangeEventName,
  type TodoChangedPayload,
} from "./todo-published-events.constants.js";

export class TodoChangedEvent {
  readonly eventName: TodoChangeEventName;
  readonly eventId: string;
  readonly occurredAt: Temporal.Instant;
  readonly todoId: number;
  readonly userId: string;

  constructor(params: {
    readonly eventName: TodoChangeEventName;
    readonly eventId: string;
    readonly occurredAt: Temporal.Instant;
    readonly todoId: number;
    readonly userId: string;
  }) {
    this.eventName = params.eventName;
    this.eventId = params.eventId;
    this.occurredAt = params.occurredAt;
    this.todoId = params.todoId;
    this.userId = params.userId;
  }

  toPayload(): TodoChangedPayload {
    return {
      todoId: this.todoId,
      userId: this.userId,
      occurredAt: toIsoString(this.occurredAt),
    };
  }
}
