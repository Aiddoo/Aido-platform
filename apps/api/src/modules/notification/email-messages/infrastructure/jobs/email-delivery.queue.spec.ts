import { EMAIL_DELIVERY_QUEUE, EmailDeliveryJobSchema } from "./email-delivery.queue.js";

describe("이메일 발송 큐 계약", () => {
  it("배포 전에 담긴 옛 payload를 그대로 읽는다", () => {
    // Given
    const queuedBeforeDeploy = {
      deliveryId: "user-report:r1",
      kind: "user-report",
      sealed: "v1:x",
    };

    // When
    const result = EmailDeliveryJobSchema.safeParse(queuedBeforeDeploy);

    // Then
    expect(result.success).toBe(true);
  });

  it("모양이 틀린 잡은 schema가 거절해 발송 handler에 오지 않는다", () => {
    // When
    const missingFields = EmailDeliveryJobSchema.safeParse({ deliveryId: "x" });
    const unknownKind = EmailDeliveryJobSchema.safeParse({
      deliveryId: "x",
      kind: "unknown",
      sealed: "v1:x",
    });

    // Then
    expect(missingFields.success).toBe(false);
    expect(unknownKind.success).toBe(false);
  });

  it("재시도는 큐 한 층에서만 하도록 같은 이름에 4회·5초 지수 backoff로 정의하고 DLQ는 없다", () => {
    // When
    const queue = EMAIL_DELIVERY_QUEUE;

    // Then
    expect(queue.name).toBe("email-delivery.v1");
    expect(queue.retry).toEqual({
      retryLimit: 4,
      retryDelaySeconds: 5,
      retryBackoff: true,
      expireInSeconds: 600,
      retentionSeconds: 3600,
      deleteAfterSeconds: 3600,
    });
    expect(queue.deadLetter).toBeUndefined();
    expect(queue.worker).toEqual({ localConcurrency: 2, pollingIntervalSeconds: 2 });
  });
});
