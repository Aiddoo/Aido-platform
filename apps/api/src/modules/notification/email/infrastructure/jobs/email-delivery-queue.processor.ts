import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import { EncryptionService } from "#api/platform/encryption/encryption.service";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { EmailAlerts } from "../../application/email.alerts.js";
import { DeliverEmailUseCase } from "../../application/use-cases/deliver-email.use-case.js";
import { EmailMessage } from "../../domain/email-message.vo.js";
import {
  EMAIL_DELIVERY_QUEUE,
  type EmailDeliveryJob,
  SealedEmailSchema,
} from "./email-delivery.queue.js";

/** 큐 잡의 메시지를 복호화해 DeliverEmail에 넘기는 진입 어댑터. 발송 정책은 application이 가진다. */
@Injectable()
export class EmailDeliveryQueueProcessor implements OnModuleInit {
  readonly #deliverEmail: Pick<DeliverEmailUseCase, "execute">;
  readonly #encryption: EncryptionService;
  readonly #alert: OperationalAlertPort;
  readonly #jobQueue: JobQueuePort;

  constructor(
    @Inject(DeliverEmailUseCase) deliverEmail: Pick<DeliverEmailUseCase, "execute">,
    encryption: EncryptionService,
    alert: OperationalAlertPort,
    jobQueue: JobQueuePort,
  ) {
    this.#deliverEmail = deliverEmail;
    this.#encryption = encryption;
    this.#alert = alert;
    this.#jobQueue = jobQueue;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.work(EMAIL_DELIVERY_QUEUE, async (jobs) => {
      for (const job of jobs) {
        await this.process(job.attempt, job.data);
      }
    });
  }

  async process(attempt: number, job: EmailDeliveryJob): Promise<void> {
    const message = this.#unseal(job);
    if (message == null) {
      return;
    }
    await this.#deliverEmail.execute({
      deliveryId: job.deliveryId,
      message,
      // JobQueuePort는 pg-boss의 attempt를 1부터 센다
      isFinalAttempt: attempt > EMAIL_DELIVERY_QUEUE.retry.retryLimit,
    });
  }

  /** 암호화 키가 바뀌었거나 형식이 깨진 잡은 다시 시도해도 풀리지 않아 null로 버린다. */
  #unseal(job: EmailDeliveryJob): EmailMessage | null {
    try {
      const sealed = SealedEmailSchema.parse(JSON.parse(this.#encryption.decrypt(job.sealed)));
      return EmailMessage.reconstitute({
        ...sealed,
        kind: job.kind,
        idempotencyKey: job.deliveryId,
      });
    } catch (error) {
      // 인증·문의 메일이 말없이 사라지므로 사람이 보게 한다. 키 교체나 롤백이 원인일 때가 많다.
      this.#alert.raise({
        ...EmailAlerts.DELIVERY_UNSEAL_FAILED,
        details: { kind: job.kind, errorType: toErrorType(error) },
      });
      return null;
    }
  }
}
