import type { MemoPrimitives } from "../../domain/memo.aggregate.js";

/** 계획을 저장하는 다른 Context(voice)가 받는 메모. Idempotency-Key·해시는 메모 저장 안에서만 쓴다 */
export type PlanMemoReadModel = Omit<MemoPrimitives, "idempotencyKey" | "requestHash">;
