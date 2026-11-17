import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { match } from "ts-pattern";
import type { z } from "zod";

import { type JobEnvelope, JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { DeliverPushNotificationsUseCase } from "../../application/use-cases/deliver-push-notifications.use-case.js";
import { RecoverFailedPushDeliveriesUseCase } from "../../application/use-cases/recover-failed-push-deliveries.use-case.js";
import { RelayPushDeliveryOutboxUseCase } from "../../application/use-cases/relay-push-delivery-outbox.use-case.js";
import {
  PUSH_DELIVERY_DEAD_LETTER_QUEUE,
  PUSH_DELIVERY_QUEUE,
  PUSH_DELIVERY_TRANSACTIONAL_QUEUE,
  PushDeliveryDeadLetterJobSchema,
  PushDeliveryJobName,
  PushDeliveryRuntimeJobSchema,
} from "./push-delivery.queue.js";

type PushDeliveryJob = z.output<typeof PushDeliveryRuntimeJobSchema>;
type PushDeliveryDeadLetterJob = z.output<typeof PushDeliveryDeadLetterJobSchema>;

// 큐 입력을 UseCase로 나누기만 한다. 발송 정책과 상태 전이는 application에 있다
@Injectable()
export class PushDeliveryQueueProcessor implements OnModuleInit {
  readonly #relayOutbox: Pick<RelayPushDeliveryOutboxUseCase, "execute">;
  readonly #deliverPushNotifications: Pick<DeliverPushNotificationsUseCase, "execute">;
  readonly #recoverFailedDeliveries: Pick<RecoverFailedPushDeliveriesUseCase, "execute">;
  readonly #jobQueue: JobQueuePort;

  constructor(
    @Inject(RelayPushDeliveryOutboxUseCase) relayOutbox: Pick<
      RelayPushDeliveryOutboxUseCase,
      "execute"
    >,
    @Inject(DeliverPushNotificationsUseCase) deliverPushNotifications: Pick<
      DeliverPushNotificationsUseCase,
      "execute"
    >,
    @Inject(RecoverFailedPushDeliveriesUseCase) recoverFailedDeliveries: Pick<
      RecoverFailedPushDeliveriesUseCase,
      "execute"
    >,
    jobQueue: JobQueuePort,
  ) {
    this.#relayOutbox = relayOutbox;
    this.#deliverPushNotifications = deliverPushNotifications;
    this.#recoverFailedDeliveries = recoverFailedDeliveries;
    this.#jobQueue = jobQueue;
  }

  async onModuleInit(): Promise<void> {
    const handleDeliveries = async (
      jobs: readonly JobEnvelope<PushDeliveryJob>[],
    ): Promise<void> => {
      for (const job of jobs) {
        await this.process(job.id, job.attempt, job.data);
      }
    };
    await this.#jobQueue.work(PUSH_DELIVERY_QUEUE, handleDeliveries);
    await this.#jobQueue.work(PUSH_DELIVERY_TRANSACTIONAL_QUEUE, handleDeliveries);
    await this.#jobQueue.work(PUSH_DELIVERY_DEAD_LETTER_QUEUE, async (jobs) => {
      for (const job of jobs) {
        await this.processDeadLetter(job.data);
      }
    });
  }

  async process(processingJobId: string, jobAttempt: number, job: PushDeliveryJob): Promise<void> {
    return match(job)
      .with({ name: PushDeliveryJobName.RELAY_OUTBOX }, () => this.#relayOutbox.execute())
      .with({ name: PushDeliveryJobName.DELIVER_DISPATCHES }, ({ data }) =>
        this.#deliverPushNotifications.execute({
          processingJobId,
          processingJobAttempt: jobAttempt,
          publications: data,
          // JobQueuePort는 pg-boss의 attempt를 1부터 센다
          isFinalAttempt: jobAttempt > PUSH_DELIVERY_QUEUE.retry.retryLimit,
        }),
      )
      .exhaustive();
  }

  async processDeadLetter(job: PushDeliveryDeadLetterJob): Promise<void> {
    await this.#recoverFailedDeliveries.execute({ publications: job.data });
  }
}
