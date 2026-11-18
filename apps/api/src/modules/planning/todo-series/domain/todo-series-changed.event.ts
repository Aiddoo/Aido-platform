import { toIsoString } from "#api/shared/domain/time/instant";

import {
  type TodoSeriesChangeEventName,
  type TodoSeriesChangedPayload,
} from "./todo-series-published-events.constants.js";

// 회차 여러 개가 한 번에 바뀐 사실이라 회차마다가 아니라 규칙당 하나만 낸다
export class TodoSeriesChangedEvent {
  readonly eventName: TodoSeriesChangeEventName;
  readonly eventId: string;
  readonly occurredAt: Temporal.Instant;
  readonly seriesId: string;
  readonly userId: string;

  constructor(params: {
    readonly eventName: TodoSeriesChangeEventName;
    readonly eventId: string;
    readonly occurredAt: Temporal.Instant;
    readonly seriesId: string;
    readonly userId: string;
  }) {
    this.eventName = params.eventName;
    this.eventId = params.eventId;
    this.occurredAt = params.occurredAt;
    this.seriesId = params.seriesId;
    this.userId = params.userId;
  }

  toPayload(): TodoSeriesChangedPayload {
    return {
      seriesId: this.seriesId,
      userId: this.userId,
      occurredAt: toIsoString(this.occurredAt),
    };
  }
}
