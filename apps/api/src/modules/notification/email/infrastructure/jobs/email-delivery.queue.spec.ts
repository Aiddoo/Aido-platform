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
    expect(EmailDeliveryJobSchema.safeParse({ deliveryId: "x" }).success).toBe(false);
    expect(
      EmailDeliveryJobSchema.safeParse({ deliveryId: "x", kind: "unknown", sealed: "v1:x" })
        .success,
    ).toBe(false);
  });

  it("재시도는 큐 한 층에서만 하도록 같은 이름에 4회·5초 지수 backoff로 정의하고 DLQ는 없다", () => {
    expect(EMAIL_DELIVERY_QUEUE.name).toBe("email-delivery.v1");
    expect(EMAIL_DELIVERY_QUEUE.retry).toEqual({
      retryLimit: 4,
      retryDelaySeconds: 5,
      retryBackoff: true,
      expireInSeconds: 600,
      retentionSeconds: 3_600,
      deleteAfterSeconds: 3_600,
    });
    expect(EMAIL_DELIVERY_QUEUE.deadLetter).toBeUndefined();
    expect(EMAIL_DELIVERY_QUEUE.worker).toEqual({ localConcurrency: 2, pollingIntervalSeconds: 2 });
  });
});
