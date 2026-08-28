import type { PushDeliveryPublication } from "../types/push-delivery.types";

export const PUSH_DELIVERY_JOB_ENQUEUER = Symbol("PUSH_DELIVERY_JOB_ENQUEUER");

/** 일반 push outbox를 durable delivery queue에 발행하는 capability. */
export interface PushDeliveryJobEnqueuerPort {
	enqueueDeliveries(publications: readonly PushDeliveryPublication[]): Promise<void>;
}
