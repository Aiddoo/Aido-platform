import { toIsoString } from "#api/shared/domain/time/instant";

// 다른 Context에 트랜잭션 안에서 보내는 할 일 사실. 옛 todo.* 이름(커밋 뒤 in-process)은 구독이 옮겨질 때까지 함께 나간다
export const TODO_CHANGE_EVENT_NAMES = [
  "planning.todo.created",
  "planning.todo.updated",
  "planning.todo.completed",
  "planning.todo.reopened",
  "planning.todo.rescheduled",
  "planning.todo.category-changed",
  "planning.todo.visibility-changed",
  "planning.todo.deleted",
] as const;

export type TodoChangeEventName = (typeof TODO_CHANGE_EVENT_NAMES)[number];

export type TodoChangedPayload = {
  readonly todoId: number;
  readonly userId: string;
  readonly occurredAt: string;
};

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
