import { Inject, Injectable, type OnModuleInit, Optional } from "@nestjs/common";
import { match } from "ts-pattern";

import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/index";

import { DeliverPushNotificationsUseCase } from "../../application/use-cases/deliver-push-notifications.use-case.js";
import { RecoverFailedPushDeliveriesUseCase } from "../../application/use-cases/recover-failed-push-deliveries.use-case.js";
import { RelayPushDeliveryOutboxUseCase } from "../../application/use-cases/relay-push-delivery-outbox.use-case.js";
import {
  PUSH_DELIVERY_QUEUE,
  PUSH_DELIVERY_DEAD_LETTER_QUEUE,
  PUSH_DELIVERY_DEAD_LETTER_WORKER_POLICY,
  PUSH_DELIVERY_JOB_POLICY,
  PUSH_DELIVERY_WORKER_POLICY,
  PushDeliveryJobName,
  PushDeliveryDeadLetterJobSchema,
  PushDeliveryRuntimeJobSchema,
} from "./push-delivery-queue.constants.js";

/** Queue transport parser/router. Delivery policy and state transitions remain in application. */
@Injectable()
export class PushDeliveryQueueProcessor implements OnModuleInit {
  readonly #relayOutbox: RelayPushDeliveryOutboxUseCase;
  readonly #deliverPushNotifications: DeliverPushNotificationsUseCase;
  readonly #recoverFailedDeliveries: RecoverFailedPushDeliveriesUseCase;
  readonly #runtime: JobRuntimePort | undefined;

  constructor(
    relayOutbox: RelayPushDeliveryOutboxUseCase,
    deliverPushNotifications: DeliverPushNotificationsUseCase,
    recoverFailedDeliveries: RecoverFailedPushDeliveriesUseCase,
    @Optional()
    @Inject(JOB_RUNTIME)
    runtime?: JobRuntimePort,
  ) {
    this.#relayOutbox = relayOutbox;
    this.#deliverPushNotifications = deliverPushNotifications;
    this.#recoverFailedDeliveries = recoverFailedDeliveries;
    this.#runtime = runtime;
  }

  async onModuleInit(): Promise<void> {
    if (!this.#runtime) {
      return;
    }
    await this.#runtime.work(
      PUSH_DELIVERY_QUEUE,
      async (jobs) => {
        for (const job of jobs) {
          await this.process(job.id, job.attempt, job.data);
        }
      },
      PUSH_DELIVERY_WORKER_POLICY,
    );
    await this.#runtime.work(
      PUSH_DELIVERY_DEAD_LETTER_QUEUE,
      async (jobs) => {
        for (const job of jobs) {
          await this.processDeadLetter(job.data);
        }
      },
      PUSH_DELIVERY_DEAD_LETTER_WORKER_POLICY,
    );
  }

  async process(processingJobId: string, jobAttempt: number, untrustedJob: unknown): Promise<void> {
    const job = PushDeliveryRuntimeJobSchema.parse(untrustedJob);
    return match(job)
      .with({ name: PushDeliveryJobName.RELAY_OUTBOX }, () => this.#relayOutbox.execute())
      .with({ name: PushDeliveryJobName.DELIVER_DISPATCHES }, ({ data }) =>
        this.#deliverPushNotifications.execute({
          processingJobId,
          processingJobAttempt: jobAttempt,
          publications: data,
          // JobRuntime은 pg-boss의 attempt를 1-based로 정규화한다.
          isFinalAttempt: jobAttempt > PUSH_DELIVERY_JOB_POLICY.retryLimit,
        }),
      )
      .exhaustive();
  }

  async processDeadLetter(untrustedJob: unknown): Promise<void> {
    const job = PushDeliveryDeadLetterJobSchema.parse(untrustedJob);
    await this.#recoverFailedDeliveries.execute({ publications: job.data });
  }
}
