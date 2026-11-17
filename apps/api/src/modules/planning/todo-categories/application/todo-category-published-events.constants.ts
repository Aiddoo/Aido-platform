import { z } from "zod";

import type { CategoryChangedPayload } from "../domain/category-changed.event.js";

// 구독 Context가 defineEventSubscription의 payloadSchema로 쓴다. 발행 쪽 toPayload와 모양이 같아야 한다
export const categoryChangedPayloadSchema = z.object({
  categoryId: z.number().int(),
  userId: z.string(),
  occurredAt: z.iso.datetime(),
}) satisfies z.ZodType<CategoryChangedPayload>;
