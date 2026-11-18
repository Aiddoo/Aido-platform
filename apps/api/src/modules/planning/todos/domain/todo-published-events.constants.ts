import { z } from "zod";

// 다른 Context에 트랜잭션 안에서 보내는 할 일 사실. durable 구독 이름이라 바꾸지 않는다
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

// 구독 Context가 defineEventSubscription의 payloadSchema로 쓴다. 발행 쪽 toPayload와 모양이 같아야 한다
export const todoChangedPayloadSchema = z.object({
  todoId: z.number().int(),
  userId: z.string(),
  occurredAt: z.iso.datetime(),
});

export type TodoChangedPayload = z.infer<typeof todoChangedPayloadSchema>;
