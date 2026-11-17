import type { PushDeliveryLane } from "../../domain/push-delivery-lane.domain-service.js";
import type { PushDeliveryPublication } from "../read-models/push-delivery.read-model.js";

// 일반 push outbox를 durable delivery queue에 발행한다. 한 번에 넘기는 publication은 모두 같은 차선이다
export abstract class PushDeliveryJobEnqueuerPort {
  abstract enqueueDeliveries(
    publications: readonly PushDeliveryPublication[],
    lane: PushDeliveryLane,
  ): Promise<void>;
}
