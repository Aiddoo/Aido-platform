import { z } from "zod";

// 다른 Context에 트랜잭션 안에서 보내는 카테고리 사실
export const CATEGORY_CHANGE_EVENT_NAMES = [
  "planning.todo-category.updated",
  "planning.todo-category.deleted",
] as const;

export type CategoryChangeEventName = (typeof CATEGORY_CHANGE_EVENT_NAMES)[number];

// 구독 Context가 defineEventSubscription의 payloadSchema로 쓴다. 발행 쪽 toPayload와 모양이 같아야 한다
export const categoryChangedPayloadSchema = z.object({
  categoryId: z.int(),
  userId: z.string(),
  occurredAt: z.iso.datetime(),
});

export type CategoryChangedPayload = z.infer<typeof categoryChangedPayloadSchema>;
