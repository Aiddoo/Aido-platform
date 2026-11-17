import { Injectable } from "@nestjs/common";

import { EncryptionService } from "#api/platform/encryption/encryption.service";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import {
  EmailDeliveryQueuePort,
  type EmailDelivery,
  type EmailEnqueueResult,
} from "../../application/ports/email-delivery-queue.port.js";
import { EMAIL_DELIVERY_QUEUE, type EmailDeliveryJob } from "./email-delivery.queue.js";

/** 이메일 발송 건을 pg-boss 큐에 담는다. 메시지는 암호화해 담고 job key는 deliveryId다. */
@Injectable()
export class EmailDeliveryQueueAdapter extends EmailDeliveryQueuePort {
  readonly #jobQueue: JobQueuePort;
  readonly #encryption: EncryptionService;

  constructor(jobQueue: JobQueuePort, encryption: EncryptionService) {
    super();
    this.#jobQueue = jobQueue;
    this.#encryption = encryption;
  }

  async enqueue({ deliveryId, message }: EmailDelivery): Promise<EmailEnqueueResult> {
    const job: EmailDeliveryJob = {
      deliveryId,
      kind: message.kind,
      sealed: this.#encryption.encrypt(JSON.stringify(message.toPrimitives())),
    };
    const jobId = await this.#jobQueue.enqueue(EMAIL_DELIVERY_QUEUE, job, {
      idempotencyKey: deliveryId,
    });
    return jobId == null ? "duplicate" : "queued";
  }
}
