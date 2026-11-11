import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { runInBackground } from "#api/platform/jobs/non-blocking-init";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import type { PushDeliveryJobEnqueuerPort } from "../../application/ports/push-delivery-job-enqueuer.port.js";
import type { PushDeliveryPublication } from "../../application/read-models/push-delivery.read-model.js";
import type { PushDeliveryLane } from "../../domain/push-delivery-lane.domain-service.js";
import { pushDeliveryJobKey } from "./notification-job-keys.constants.js";
import {
  PUSH_DELIVERY_PRIORITY,
  PUSH_DELIVERY_QUEUE,
  PUSH_DELIVERY_RELAY_SCHEDULE_QUEUE,
  PushDeliveryJobName,
} from "./push-delivery.queue.js";

@Injectable()
export class PushDeliveryQueueAdapter implements PushDeliveryJobEnqueuerPort, OnModuleInit {
  readonly #logger = new Logger(PushDeliveryQueueAdapter.name);
  schedulerRegistration: Promise<void> = Promise.resolve();

  readonly #jobQueue: JobQueuePort;

  constructor(jobQueue: JobQueuePort) {
    this.#jobQueue = jobQueue;
  }

  onModuleInit(): void {
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Push delivery outbox relay scheduler registration",
      () => this.#jobQueue.registerSchedules(PUSH_DELIVERY_RELAY_SCHEDULE_QUEUE),
    );
  }

  async enqueueDeliveries(
    publications: readonly PushDeliveryPublication[],
    lane: PushDeliveryLane,
  ): Promise<void> {
    // strict payload schema가 받는 필드만 싣는다
    const data = publications.map(({ dispatchId, publishAttempt }) => ({
      dispatchId,
      publishAttempt,
    }));
    await this.#jobQueue.enqueue(
      PUSH_DELIVERY_QUEUE,
      { name: PushDeliveryJobName.DELIVER_DISPATCHES, data },
      { idempotencyKey: pushDeliveryJobKey(data), priority: PUSH_DELIVERY_PRIORITY[lane] },
    );
  }
}
