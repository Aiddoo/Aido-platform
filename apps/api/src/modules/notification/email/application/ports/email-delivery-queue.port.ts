import type { EmailMessage } from "../../domain/email-message.vo.js";

const EMAIL_ENQUEUE_RESULTS = ["queued", "duplicate"] as const;
export type EmailEnqueueResult = (typeof EMAIL_ENQUEUE_RESULTS)[number];

export interface EmailDelivery {
  /** 같은 발송 건은 큐에 한 번만 담기고 공급자에도 같은 멱등 키로 나간다 */
  readonly deliveryId: string;
  readonly message: EmailMessage;
}

/** 이메일 발송 건을 비동기 발송 큐에 담는다. 같은 deliveryId가 이미 있으면 duplicate이고, 담지 못하면 던진다. */
export abstract class EmailDeliveryQueuePort {
  abstract enqueue(delivery: EmailDelivery): Promise<EmailEnqueueResult>;
}
