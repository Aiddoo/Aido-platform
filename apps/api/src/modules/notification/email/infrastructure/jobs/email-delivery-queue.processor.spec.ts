import { EncryptionService } from "#api/platform/encryption/encryption.service";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import {
  createEmailMessageFixture,
  EMAIL_MESSAGE_FIXTURE_CODE,
  EMAIL_MESSAGE_FIXTURE_RECIPIENT,
} from "#test/fixtures/notification/email-message.fixture";

import type { DeliverEmailInput } from "../../application/use-cases/deliver-email.use-case.js";
import { EmailDeliveryQueueAdapter } from "./email-delivery-queue.adapter.js";
import { EmailDeliveryQueueProcessor } from "./email-delivery-queue.processor.js";
import { EMAIL_DELIVERY_QUEUE, type EmailDeliveryJob } from "./email-delivery.queue.js";

class RecordingDeliverEmail {
  readonly inputs: DeliverEmailInput[] = [];

  async execute(input: DeliverEmailInput): Promise<void> {
    this.inputs.push(input);
  }
}

describe("EmailDeliveryQueueProcessor", () => {
  const encryption = new EncryptionService({
    key: "test-token-encryption-key-minimum-32-characters-long",
    salt: undefined,
  });
  let jobQueue: InMemoryJobQueue;
  let alert: RecordingOperationalAlert;
  let deliverEmail: RecordingDeliverEmail;
  let processor: EmailDeliveryQueueProcessor;

  beforeEach(() => {
    jobQueue = new InMemoryJobQueue();
    alert = new RecordingOperationalAlert();
    deliverEmail = new RecordingDeliverEmail();
    processor = new EmailDeliveryQueueProcessor(deliverEmail, encryption, alert, jobQueue);
  });

  async function sealedJob(): Promise<EmailDeliveryJob> {
    await new EmailDeliveryQueueAdapter(jobQueue, encryption).enqueue({
      deliveryId: "delivery-1",
      message: createEmailMessageFixture(),
    });
    const parsed = EMAIL_DELIVERY_QUEUE.payloadSchema.parse(jobQueue.jobs.at(-1)?.payload);
    jobQueue.clear();
    return parsed;
  }

  it("잡을 풀어 같은 메시지를 deliveryId를 멱등 키로 해서 DeliverEmail에 넘긴다", async () => {
    // Given
    const job = await sealedJob();

    // When
    await processor.process(1, job);

    // Then
    const [delivery] = deliverEmail.inputs;
    expect(delivery?.deliveryId).toBe("delivery-1");
    expect(delivery?.message.idempotencyKey).toBe("delivery-1");
    expect(delivery?.message.to).toBe(EMAIL_MESSAGE_FIXTURE_RECIPIENT);
    expect(delivery?.message.text).toContain(EMAIL_MESSAGE_FIXTURE_CODE);
    expect(delivery?.message.kind).toBe("verification");
    expect(delivery?.isFinalAttempt).toBe(false);
  });

  it("재시도 한도를 넘긴 시도부터 마지막 시도로 알린다", async () => {
    // Given
    const job = await sealedJob();

    // When
    await processor.process(EMAIL_DELIVERY_QUEUE.retry.retryLimit, job);
    await processor.process(EMAIL_DELIVERY_QUEUE.retry.retryLimit + 1, job);

    // Then
    expect(deliverEmail.inputs.map((delivery) => delivery.isFinalAttempt)).toEqual([false, true]);
  });

  it("복호화할 수 없는 잡(키 교체 등)은 다시 시도해도 풀리지 않아 발송 없이 버리고 경보를 올린다", async () => {
    // Given
    const job = await sealedJob();

    // When
    await processor.process(1, { ...job, sealed: "not:a:sealed-value" });

    // Then
    expect(deliverEmail.inputs).toEqual([]);
    expect(alert.alerts).toEqual([
      expect.objectContaining({
        key: "notification.email.delivery-unseal-failed",
        details: expect.objectContaining({ kind: "verification" }),
      }),
    ]);
  });

  it("시작하면 email-delivery.v1 worker를 등록해 담긴 잡을 처리한다", async () => {
    // Given
    await processor.onModuleInit();
    await new EmailDeliveryQueueAdapter(jobQueue, encryption).enqueue({
      deliveryId: "delivery-2",
      message: createEmailMessageFixture(),
    });

    // When
    await jobQueue.drain(EMAIL_DELIVERY_QUEUE);

    // Then
    expect(deliverEmail.inputs.map((delivery) => delivery.deliveryId)).toEqual(["delivery-2"]);
  });
});
