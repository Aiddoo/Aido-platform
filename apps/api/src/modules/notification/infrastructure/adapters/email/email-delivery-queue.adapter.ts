import { Inject, Injectable } from "@nestjs/common";

import { EncryptionService } from "#api/platform/encryption/encryption.service";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import type {
  EmailDelivery,
  EmailDeliveryQueuePort,
} from "../../../application/ports/email/email-delivery-queue.port.js";
import {
  EMAIL_DELIVERY_JOB_POLICY,
  EMAIL_DELIVERY_QUEUE,
  type EmailDeliveryJob,
} from "../../jobs/email/email-delivery-queue.constants.js";

/** 이메일 발송 건을 pg-boss 큐에 담는다. 메시지는 암호화해 담는다. */
@Injectable()
export class EmailDeliveryQueueAdapter implements EmailDeliveryQueuePort {
  constructor(
    @Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort,
    private readonly encryption: EncryptionService,
  ) {}

  async enqueue({ deliveryId, message }: EmailDelivery): Promise<"queued" | "duplicate"> {
    const job: EmailDeliveryJob = {
      deliveryId,
      kind: message.kind,
      sealed: this.encryption.encrypt(JSON.stringify(message.toProps())),
    };
    const jobId = await this.runtime.enqueue(EMAIL_DELIVERY_QUEUE, job, {
      ...EMAIL_DELIVERY_JOB_POLICY,
      idempotencyKey: deliveryId,
    });
    return jobId == null ? "duplicate" : "queued";
  }
}
