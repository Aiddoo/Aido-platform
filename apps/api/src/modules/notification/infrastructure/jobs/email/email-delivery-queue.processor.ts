import { Inject, Injectable, Logger, type OnModuleInit, Optional } from "@nestjs/common";

import { EncryptionService } from "#api/platform/encryption/encryption.service";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/index";

import { DeliverEmail } from "../../../application/use-cases/email/deliver-email.use-case.js";
import { EmailMessage } from "../../../domain/value-objects/email/email-message.vo.js";
import { EmailLogEvent } from "../../observability/email/email-log.events.js";
import {
  EMAIL_DELIVERY_JOB_POLICY,
  EMAIL_DELIVERY_QUEUE,
  EMAIL_DELIVERY_WORKER_POLICY,
  type EmailDeliveryJob,
  EmailDeliveryJobSchema,
  SealedEmailSchema,
} from "./email-delivery-queue.constants.js";

/** 큐 잡을 읽고 메시지를 복호화해 DeliverEmail에 넘기는 진입 어댑터. 발송 정책은 application이 가진다. */
@Injectable()
export class EmailDeliveryQueueProcessor implements OnModuleInit {
  readonly #logger = new Logger(EmailDeliveryQueueProcessor.name);

  constructor(
    private readonly deliverEmail: DeliverEmail,
    private readonly encryption: EncryptionService,
    @Optional()
    @Inject(JOB_RUNTIME)
    private readonly runtime?: JobRuntimePort,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.runtime) {
      return;
    }
    await this.runtime.work(
      EMAIL_DELIVERY_QUEUE,
      async (jobs) => {
        for (const job of jobs) {
          await this.process(job.attempt, job.data);
        }
      },
      EMAIL_DELIVERY_WORKER_POLICY,
    );
  }

  async process(attempt: number, untrustedJob: unknown): Promise<void> {
    const job = EmailDeliveryJobSchema.safeParse(untrustedJob);
    const message = job.success ? this.#unseal(job.data) : null;
    if (!job.success || message == null) {
      this.#logger.warn({ event: EmailLogEvent.JOB_INVALID, queueName: EMAIL_DELIVERY_QUEUE });
      return;
    }
    await this.deliverEmail.execute({
      deliveryId: job.data.deliveryId,
      message,
      // JobRuntime은 pg-boss의 attempt를 1-based로 정규화한다.
      isFinalAttempt: attempt > EMAIL_DELIVERY_JOB_POLICY.retryLimit,
    });
  }

  /** 암호화 키가 바뀌었거나 형식이 깨진 잡은 다시 시도해도 풀리지 않아 null로 버린다. */
  #unseal(job: EmailDeliveryJob): EmailMessage | null {
    try {
      const sealed = SealedEmailSchema.parse(JSON.parse(this.encryption.decrypt(job.sealed)));
      return EmailMessage.create({ ...sealed, kind: job.kind, idempotencyKey: job.deliveryId });
    } catch {
      return null;
    }
  }
}
