import { Logger } from "@nestjs/common";
import { vi } from "vitest";
import { mock, type MockProxy } from "vitest-mock-extended";

import { TypedConfigService } from "#api/platform/config/services/config.service";
import { EncryptionService } from "#api/platform/encryption/encryption.service";
import type { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { FakeJobRuntime } from "#test/mocks/fake-job-runtime";

import { createVerificationCodeEmail } from "../../../application/services/email/email-message.factory.js";
import type { DeliverEmail } from "../../../application/use-cases/email/deliver-email.use-case.js";
import { EmailDeliveryQueueAdapter } from "../../adapters/email/email-delivery-queue.adapter.js";
import { EmailLogEvent } from "../../observability/email/email-log.events.js";
import {
  EMAIL_DELIVERY_JOB_POLICY,
  EMAIL_DELIVERY_QUEUE,
} from "./email-delivery-queue.constants.js";
import { EmailDeliveryQueueProcessor } from "./email-delivery-queue.processor.js";

describe("EmailDeliveryQueueProcessor", () => {
  const encryption = new EncryptionService(
    mock<TypedConfigService>({
      tokenEncryptionKey: "test-token-encryption-key-minimum-32-characters-long",
      tokenEncryptionSalt: undefined,
    }),
  );
  let runtime: FakeJobRuntime;
  let alert: MockProxy<OperationalAlertPort>;
  let deliveries: Parameters<DeliverEmail["execute"]>[0][];
  let processor: EmailDeliveryQueueProcessor;

  beforeEach(() => {
    runtime = new FakeJobRuntime();
    alert = mock<OperationalAlertPort>();
    deliveries = [];
    const deliverEmail = mock<DeliverEmail>();
    deliverEmail.execute.mockImplementation(async (input) => void deliveries.push(input));
    processor = new EmailDeliveryQueueProcessor(deliverEmail, encryption, alert, runtime);
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function sealedJob() {
    const message = createVerificationCodeEmail("user@example.com", {
      code: "123456",
      expiryMinutes: 10,
    });
    await new EmailDeliveryQueueAdapter(runtime, encryption).enqueue({
      deliveryId: "delivery-1",
      message,
    });
    return runtime.enqueueCalls[0]?.data;
  }

  it("잡을 풀어 같은 메시지를 deliveryId를 멱등 키로 해서 DeliverEmail에 넘긴다", async () => {
    // Given
    const job = await sealedJob();

    // When
    await processor.process(1, job);

    // Then
    const [delivery] = deliveries;
    expect(delivery?.deliveryId).toBe("delivery-1");
    expect(delivery?.message.idempotencyKey).toBe("delivery-1");
    expect(delivery?.message.to).toBe("user@example.com");
    expect(delivery?.message.text).toContain("123456");
    expect(delivery?.message.kind).toBe("verification");
    expect(delivery?.isFinalAttempt).toBe(false);
  });

  it("재시도 한도를 넘긴 시도부터 마지막 시도로 알린다", async () => {
    // Given
    const job = await sealedJob();

    // When
    await processor.process(EMAIL_DELIVERY_JOB_POLICY.retryLimit, job);
    await processor.process(EMAIL_DELIVERY_JOB_POLICY.retryLimit + 1, job);

    // Then
    expect(deliveries.map((delivery) => delivery.isFinalAttempt)).toEqual([false, true]);
  });

  it("모양이 틀린 잡은 발송 없이 버리고 경고만 남긴다", async () => {
    // When
    await processor.process(1, { deliveryId: "x" });

    // Then
    expect(deliveries).toEqual([]);
    expect(Logger.prototype.warn).toHaveBeenCalledExactlyOnceWith({
      event: EmailLogEvent.JOB_INVALID,
      queueName: EMAIL_DELIVERY_QUEUE,
    });
  });

  it("복호화할 수 없는 잡(키 교체 등)은 다시 시도해도 풀리지 않아 발송 없이 버린다", async () => {
    // Given
    const job = await sealedJob();

    // When
    await processor.process(1, { ...job, sealed: "not:a:sealed-value" });

    // Then
    expect(deliveries).toEqual([]);
    expect(Logger.prototype.warn).toHaveBeenCalledTimes(1);
    expect(alert.raise).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        key: "notification.email.delivery-unseal-failed",
        details: expect.objectContaining({ kind: "verification" }),
      }),
    );
  });

  it("시작하면 email-delivery.v1 worker를 teamSize 2, 2초 폴링으로 등록한다", async () => {
    // When
    await processor.onModuleInit();

    // Then
    expect(runtime.workCalls).toEqual([
      { queue: EMAIL_DELIVERY_QUEUE, options: { teamSize: 2, pollingIntervalSeconds: 2 } },
    ]);
  });
});
