import { Injectable } from "@nestjs/common";

import { EncryptionService } from "#api/platform/encryption/encryption.service";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import {
  EmailDeliveryQueuePort,
  type EmailDelivery,
  type EmailEnqueueResult,
} from "../../application/ports/email-delivery-queue.port.js";
import type { EmailMessage } from "../../domain/email-message.aggregate.js";
import { EMAIL_DELIVERY_QUEUE, type EmailDeliveryJob } from "./email-delivery.queue.js";

// 암호화해 큐에 싣는 본문이다. 담긴 모양은 이전 배포의 작업과 같아야 한다(발송 건 id는 작업에 따로 있다)
function sealedContentOf(message: EmailMessage) {
  const { kind, to, subject, html, text, tags } = message.toPrimitives();
  return { kind, to, subject, html, text, tags };
}

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
      sealed: this.#encryption.encrypt(JSON.stringify(sealedContentOf(message))),
    };
    const jobId = await this.#jobQueue.enqueue(EMAIL_DELIVERY_QUEUE, job, {
      idempotencyKey: deliveryId,
    });
    return jobId == null ? "duplicate" : "queued";
  }
}
