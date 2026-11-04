import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { runInBackground } from "#api/platform/jobs/non-blocking-init";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/index";

import type { PushDeliveryJobEnqueuerPort } from "../../../application/ports/delivery/push-delivery-job-enqueuer.port.js";
import type { PushDeliveryPublication } from "../../../application/types/delivery/push-delivery.types.js";
import { pushDeliveryJobKey } from "../notification-job-keys.js";
import {
  PUSH_DELIVERY_DISPATCH_JOB_POLICY,
  PUSH_DELIVERY_JOB_POLICY,
  PUSH_DELIVERY_QUEUE,
  PUSH_DELIVERY_RELAY_SCHEDULE,
  PushDeliveryJobName,
} from "./push-delivery-queue.constants.js";

@Injectable()
export class PushDeliveryQueueService implements PushDeliveryJobEnqueuerPort, OnModuleInit {
  readonly #logger = new Logger(PushDeliveryQueueService.name);
  schedulerRegistration: Promise<void> = Promise.resolve();

  constructor(@Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort) {}

  onModuleInit(): void {
    this.schedulerRegistration = runInBackground(
      this.#logger,
      "Push delivery outbox relay scheduler registration",
      () =>
        this.runtime.schedule(
          PUSH_DELIVERY_RELAY_SCHEDULE.key,
          PUSH_DELIVERY_RELAY_SCHEDULE.cron,
          PUSH_DELIVERY_QUEUE,
          { name: PushDeliveryJobName.RELAY_OUTBOX, data: {} },
          PUSH_DELIVERY_JOB_POLICY,
        ),
    );
  }

  async enqueueDeliveries(publications: readonly PushDeliveryPublication[]): Promise<void> {
    await this.runtime.enqueue(
      PUSH_DELIVERY_QUEUE,
      { name: PushDeliveryJobName.DELIVER_DISPATCHES, data: publications },
      {
        ...PUSH_DELIVERY_DISPATCH_JOB_POLICY,
        idempotencyKey: pushDeliveryJobKey(publications),
      },
    );
  }
}
