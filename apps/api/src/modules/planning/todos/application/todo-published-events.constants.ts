import { z } from "zod";

import type { TodoChangedPayload } from "../../shared/domain/todo-changed.event.js";
import type { TodoSeriesChangedPayload } from "../../shared/domain/todo-series-changed.event.js";

// 구독 Context가 defineEventSubscription의 payloadSchema로 쓴다. 발행 쪽 toPayload와 모양이 같아야 한다
export const todoChangedPayloadSchema = z.object({
  todoId: z.number().int(),
  userId: z.string(),
  occurredAt: z.iso.datetime(),
}) satisfies z.ZodType<TodoChangedPayload>;

export const todoSeriesChangedPayloadSchema = z.object({
  seriesId: z.string(),
  userId: z.string(),
  occurredAt: z.iso.datetime(),
}) satisfies z.ZodType<TodoSeriesChangedPayload>;
