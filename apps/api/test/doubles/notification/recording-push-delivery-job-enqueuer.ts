import { PushDeliveryJobEnqueuerPort } from "#api/modules/notification/push/application/ports/push-delivery-job-enqueuer.port";
import type { PushDeliveryPublication } from "#api/modules/notification/push/application/read-models/push-delivery.read-model";
import type { PushDeliveryLane } from "#api/modules/notification/push/domain/push-delivery-lane.domain-service";

export interface RecordedPushDeliveryJob {
  readonly publications: readonly PushDeliveryPublication[];
  readonly lane: PushDeliveryLane;
}

// 받은 작업을 차선과 함께 남긴다. rejection을 넣으면 그 값으로 enqueue를 거부한다(Error가 아닌 값도 그대로 던진다)
export class RecordingPushDeliveryJobEnqueuer extends PushDeliveryJobEnqueuerPort {
  readonly jobs: RecordedPushDeliveryJob[] = [];
  rejection: { readonly reason: unknown } | null = null;

  async enqueueDeliveries(
    publications: readonly PushDeliveryPublication[],
    lane: PushDeliveryLane,
  ): Promise<void> {
    if (this.rejection != null) {
      throw this.rejection.reason;
    }
    this.jobs.push({ publications: [...publications], lane });
  }
}
