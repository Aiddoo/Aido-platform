import { toIsoString } from "#api/shared/domain/time/instant";

// 다른 Context에 트랜잭션 안에서 보내는 카테고리 사실
export const CATEGORY_CHANGE_EVENT_NAMES = [
  "planning.todo-category.updated",
  "planning.todo-category.deleted",
] as const;

export type CategoryChangeEventName = (typeof CATEGORY_CHANGE_EVENT_NAMES)[number];

export type CategoryChangedPayload = {
  readonly categoryId: number;
  readonly userId: string;
  readonly occurredAt: string;
};

export class CategoryChangedEvent {
  readonly eventName: CategoryChangeEventName;
  readonly eventId: string;
  readonly occurredAt: Temporal.Instant;
  readonly categoryId: number;
  readonly userId: string;

  constructor(params: {
    readonly eventName: CategoryChangeEventName;
    readonly eventId: string;
    readonly occurredAt: Temporal.Instant;
    readonly categoryId: number;
    readonly userId: string;
  }) {
    this.eventName = params.eventName;
    this.eventId = params.eventId;
    this.occurredAt = params.occurredAt;
    this.categoryId = params.categoryId;
    this.userId = params.userId;
  }

  toPayload(): CategoryChangedPayload {
    return {
      categoryId: this.categoryId,
      userId: this.userId,
      occurredAt: toIsoString(this.occurredAt),
    };
  }
}
