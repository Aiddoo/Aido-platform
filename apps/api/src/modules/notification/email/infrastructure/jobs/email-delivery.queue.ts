import { z } from "zod";

import {
  defineQueue,
  JOB_POLLING_SECONDS,
  type JobRetryPolicy,
} from "#api/shared/application/ports/job-queue.port";

import { EMAIL_KINDS } from "../../domain/email-delivery.constants.js";

/** sealed는 렌더된 메시지(인증 코드·문의 본문)를 암호화한 값이라 큐 테이블에 평문이 남지 않는다. */
export const EmailDeliveryJobSchema = z.object({
  deliveryId: z.string().min(1),
  kind: z.enum(EMAIL_KINDS),
  sealed: z.string().min(1),
});

export type EmailDeliveryJob = z.output<typeof EmailDeliveryJobSchema>;

export const SealedEmailSchema = z.object({
  to: z.string(),
  subject: z.string(),
  html: z.string(),
  text: z.string(),
  tags: z.array(z.object({ name: z.string(), value: z.string() })),
});

// 재시도는 이 한 층에서만 한다(어댑터·Mailer·요청 경로에는 재시도가 없다)
const EMAIL_DELIVERY_RETRY = {
  retryLimit: 4,
  retryDelaySeconds: 5,
  retryBackoff: true,
  expireInSeconds: 10 * 60,
  retentionSeconds: 60 * 60,
  deleteAfterSeconds: 60 * 60,
} as const satisfies JobRetryPolicy;

// 초당 10요청 제한은 bulkhead 2와 동시성 2로 맞춘다. 사용자가 코드를 기다려 폴링을 짧게 둔다
export const EMAIL_DELIVERY_QUEUE = defineQueue({
  name: "email-delivery.v1",
  payloadSchema: EmailDeliveryJobSchema,
  retry: EMAIL_DELIVERY_RETRY,
  worker: { localConcurrency: 2, pollingIntervalSeconds: JOB_POLLING_SECONDS.INTERACTIVE },
});
