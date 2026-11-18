import { z } from "zod";

export const TODO_SERIES_CHANGE_EVENT_NAMES = [
  "planning.todo-series.occurrences-created",
  "planning.todo-series.occurrences-changed",
] as const;

export type TodoSeriesChangeEventName = (typeof TODO_SERIES_CHANGE_EVENT_NAMES)[number];

// 구독 Context가 defineEventSubscription의 payloadSchema로 쓴다. 발행 쪽 toPayload와 모양이 같아야 한다
export const todoSeriesChangedPayloadSchema = z.object({
  seriesId: z.string(),
  userId: z.string(),
  occurredAt: z.iso.datetime(),
});

export type TodoSeriesChangedPayload = z.infer<typeof todoSeriesChangedPayloadSchema>;
