import { toIsoString } from "#api/shared/domain/time/instant";

import {
  type CategoryChangeEventName,
  type CategoryChangedPayload,
} from "./todo-category-published-events.constants.js";

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
