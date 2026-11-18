import { z } from "zod";

import { EncryptionService } from "#api/platform/encryption/encryption.service";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import {
  createEmailMessageFixture,
  EMAIL_MESSAGE_FIXTURE_CODE,
  EMAIL_MESSAGE_FIXTURE_RECIPIENT,
} from "#test/fixtures/notification/email-message.fixture";

import { EmailMessageId } from "../../domain/email-message-id.vo.js";
import { EmailDeliveryQueueAdapter } from "./email-delivery-queue.adapter.js";
import { EMAIL_DELIVERY_QUEUE } from "./email-delivery.queue.js";

describe("EmailDeliveryQueueAdapter", () => {
  const encryption = new EncryptionService({
    key: "test-token-encryption-key-minimum-32-characters-long",
    salt: undefined,
  });

  it("메시지를 암호화해 email-delivery.v1에 담고 평문 코드·수신자는 잡 데이터에 남기지 않는다", async () => {
    // Given
    const jobQueue = new InMemoryJobQueue();
    const adapter = new EmailDeliveryQueueAdapter(jobQueue, encryption);

    // When
    const result = await adapter.enqueue({
      deliveryId: EmailMessageId.reconstitute("delivery-1"),
      message: createEmailMessageFixture(),
    });

    // Then
    expect(result).toBe("queued");
    const [job] = jobQueue.jobsIn(EMAIL_DELIVERY_QUEUE);
    expect(job?.payload).toEqual({
      deliveryId: "delivery-1",
      kind: "verification",
      sealed: expect.any(String),
    });
    expect(job?.options).toEqual({ idempotencyKey: "delivery-1" });
    expect(JSON.stringify(job?.payload)).not.toContain(EMAIL_MESSAGE_FIXTURE_CODE);
    expect(JSON.stringify(job?.payload)).not.toContain(EMAIL_MESSAGE_FIXTURE_RECIPIENT);
  });

  it("암호문 안 본문은 이전 배포 processor가 읽던 칸 순서 그대로이고 발송 건 id를 담지 않는다", async () => {
    // Given
    const jobQueue = new InMemoryJobQueue();
    const adapter = new EmailDeliveryQueueAdapter(jobQueue, encryption);

    // When
    await adapter.enqueue({
      deliveryId: EmailMessageId.reconstitute("delivery-2"),
      message: createEmailMessageFixture(),
    });

    // Then
    const [job] = jobQueue.jobsIn(EMAIL_DELIVERY_QUEUE);
    const sealed = z.object({ sealed: z.string() }).parse(job?.payload).sealed;
    const content: unknown = JSON.parse(encryption.decrypt(sealed));
    expect(Object.keys(z.record(z.string(), z.unknown()).parse(content))).toEqual([
      "kind",
      "to",
      "subject",
      "html",
      "text",
      "tags",
    ]);
  });

  it("큐가 같은 deliveryId를 이미 가지고 있으면 duplicate로 알린다", async () => {
    // Given
    const adapter = new EmailDeliveryQueueAdapter(new InMemoryJobQueue(), encryption);
    await adapter.enqueue({
      deliveryId: EmailMessageId.reconstitute("delivery-3"),
      message: createEmailMessageFixture(),
    });

    // When
    const result = await adapter.enqueue({
      deliveryId: EmailMessageId.reconstitute("delivery-3"),
      message: createEmailMessageFixture(),
    });

    // Then
    expect(result).toBe("duplicate");
  });
});
