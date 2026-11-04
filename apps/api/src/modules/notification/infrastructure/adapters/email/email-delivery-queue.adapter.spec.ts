import { mock } from "vitest-mock-extended";

import { TypedConfigService } from "#api/platform/config/services/config.service";
import { EncryptionService } from "#api/platform/encryption/encryption.service";
import type { JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import { FakeJobRuntime } from "#test/mocks/fake-job-runtime";

import { createVerificationCodeEmail } from "../../../application/services/email/email-message.factory.js";
import { EMAIL_DELIVERY_QUEUE } from "../../jobs/email/email-delivery-queue.constants.js";
import { EmailDeliveryQueueAdapter } from "./email-delivery-queue.adapter.js";

describe("EmailDeliveryQueueAdapter", () => {
  const encryption = new EncryptionService(
    mock<TypedConfigService>({
      tokenEncryptionKey: "test-token-encryption-key-minimum-32-characters-long",
      tokenEncryptionSalt: undefined,
    }),
  );

  it("메시지를 암호화해 email-delivery.v1에 담고 평문 코드·수신자는 잡 데이터에 남기지 않는다", async () => {
    // Given
    const runtime = new FakeJobRuntime();
    const adapter = new EmailDeliveryQueueAdapter(runtime, encryption);
    const message = createVerificationCodeEmail("private@example.com", {
      code: "987654",
      expiryMinutes: 10,
    });

    // When
    const result = await adapter.enqueue({ deliveryId: "delivery-1", message });

    // Then
    expect(result).toBe("queued");
    const [call] = runtime.enqueueCalls;
    expect(call?.queue).toBe(EMAIL_DELIVERY_QUEUE);
    expect(call?.data).toEqual({
      deliveryId: "delivery-1",
      kind: "verification",
      sealed: expect.any(String),
    });
    expect(JSON.stringify(call?.data)).not.toContain("987654");
    expect(JSON.stringify(call?.data)).not.toContain("private@example.com");
  });

  it("재시도는 큐 한 층에서만 하도록 4회·5초 지수 backoff·멱등 키 deliveryId로 담는다", async () => {
    // Given
    const runtime = new FakeJobRuntime();
    const adapter = new EmailDeliveryQueueAdapter(runtime, encryption);
    const message = createVerificationCodeEmail("a@example.com", { code: "1", expiryMinutes: 1 });

    // When
    await adapter.enqueue({ deliveryId: "delivery-2", message });

    // Then
    expect(runtime.enqueueCalls[0]?.options).toEqual({
      retryLimit: 4,
      retryDelaySeconds: 5,
      retryBackoff: true,
      expireInSeconds: 600,
      retentionSeconds: 3600,
      deleteAfterSeconds: 3600,
      idempotencyKey: "delivery-2",
    });
  });

  it("큐가 같은 deliveryId를 이미 가지고 있어 null을 돌려주면 duplicate로 알린다", async () => {
    // Given
    const runtime = mock<JobRuntimePort>();
    runtime.enqueue.mockResolvedValue(null);
    const adapter = new EmailDeliveryQueueAdapter(runtime, encryption);
    const message = createVerificationCodeEmail("a@example.com", { code: "1", expiryMinutes: 1 });

    // When
    const result = await adapter.enqueue({ deliveryId: "delivery-3", message });

    // Then
    expect(result).toBe("duplicate");
  });
});
