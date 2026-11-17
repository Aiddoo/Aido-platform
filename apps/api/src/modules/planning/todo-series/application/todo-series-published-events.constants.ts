import { z } from "zod";

import type { TodoSeriesChangedPayload } from "../domain/todo-series-changed.event.js";

// 구독 Context가 defineEventSubscription의 payloadSchema로 쓴다. 발행 쪽 toPayload와 모양이 같아야 한다
export const todoSeriesChangedPayloadSchema = z.object({
  seriesId: z.string(),
  userId: z.string(),
  occurredAt: z.iso.datetime(),
}) satisfies z.ZodType<TodoSeriesChangedPayload>;
