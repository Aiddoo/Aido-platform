import { Inject, Injectable, Logger, type OnModuleInit, Optional } from "@nestjs/common";

import { EncryptionService } from "#api/platform/encryption/encryption.service";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/index";
import {
  OPERATIONAL_ALERT,
  type OperationalAlertPort,
} from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { EmailAlertKey } from "../../application/email.alerts.js";
import { DeliverEmailUseCase } from "../../application/use-cases/deliver-email.use-case.js";
import { EmailMessage } from "../../domain/email-message.vo.js";
import { EmailLogEvent } from "../adapters/email-provider.log-events.js";
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

  readonly #deliverEmail: DeliverEmailUseCase;
  readonly #encryption: EncryptionService;
  readonly #alert: OperationalAlertPort;
  readonly #runtime: JobRuntimePort | undefined;

  constructor(
    deliverEmail: DeliverEmailUseCase,
    encryption: EncryptionService,
    @Inject(OPERATIONAL_ALERT) alert: OperationalAlertPort,
    @Optional()
    @Inject(JOB_RUNTIME)
    runtime?: JobRuntimePort,
  ) {
    this.#deliverEmail = deliverEmail;
    this.#encryption = encryption;
    this.#alert = alert;
    this.#runtime = runtime;
  }

  async onModuleInit(): Promise<void> {
    if (!this.#runtime) {
      return;
    }
    await this.#runtime.work(
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
    await this.#deliverEmail.execute({
      deliveryId: job.data.deliveryId,
      message,
      // JobRuntime은 pg-boss의 attempt를 1-based로 정규화한다.
      isFinalAttempt: attempt > EMAIL_DELIVERY_JOB_POLICY.retryLimit,
    });
  }

  /** 암호화 키가 바뀌었거나 형식이 깨진 잡은 다시 시도해도 풀리지 않아 null로 버린다. */
  #unseal(job: EmailDeliveryJob): EmailMessage | null {
    try {
      const sealed = SealedEmailSchema.parse(JSON.parse(this.#encryption.decrypt(job.sealed)));
      return EmailMessage.create({ ...sealed, kind: job.kind, idempotencyKey: job.deliveryId });
    } catch (error) {
      // 인증·문의 메일이 말없이 사라지므로 사람이 보게 한다. 키 교체나 롤백이 원인일 때가 많다.
      this.#alert.raise({
        key: EmailAlertKey.DELIVERY_UNSEAL_FAILED,
        severity: "error",
        message: "발송 큐의 이메일을 풀지 못해 버렸습니다.",
        details: { kind: job.kind, errorType: toErrorType(error) },
      });
      return null;
    }
  }
}
