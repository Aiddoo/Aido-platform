import {
  PushDeliveryDeadLetterJobSchema,
  PushDeliveryJobName,
  PushDeliveryRuntimeJobSchema,
} from "./push-delivery.queue.js";

function publication(dispatchId: number, publishAttempt = 1) {
  return { dispatchId, publishAttempt };
}

describe("Push 전달 큐 계약", () => {
  it("relay와 delivery payload를 strict schema로 검증한다", () => {
    // Given
    const relayJob = { name: PushDeliveryJobName.RELAY_OUTBOX, data: {} };
    const deliveryJob = {
      name: PushDeliveryJobName.DELIVER_DISPATCHES,
      data: [publication(1)],
    };

    // When
    const relayResult = PushDeliveryRuntimeJobSchema.safeParse(relayJob);
    const deliveryResult = PushDeliveryRuntimeJobSchema.safeParse(deliveryJob);

    // Then
    expect(relayResult.success).toBe(true);
    expect(deliveryResult.success).toBe(true);
    expect(PushDeliveryRuntimeJobSchema.safeParse({ ...relayJob, unexpected: true }).success).toBe(
      false,
    );
    expect(
      PushDeliveryRuntimeJobSchema.safeParse({
        ...relayJob,
        data: { unexpected: true },
      }).success,
    ).toBe(false);
    expect(
      PushDeliveryRuntimeJobSchema.safeParse({
        ...deliveryJob,
        data: [{ ...publication(1), unexpected: true }],
      }).success,
    ).toBe(false);
  });

  it("delivery batch는 1개부터 100개까지만 허용한다", () => {
    // Given
    const emptyBatch: unknown[] = [];
    const maximumBatch = Array.from({ length: 100 }, (_, index) => publication(index + 1));
    const oversizedBatch = [...maximumBatch, publication(101)];

    // When
    const emptyResult = PushDeliveryRuntimeJobSchema.safeParse({
      name: PushDeliveryJobName.DELIVER_DISPATCHES,
      data: emptyBatch,
    });
    const maximumResult = PushDeliveryRuntimeJobSchema.safeParse({
      name: PushDeliveryJobName.DELIVER_DISPATCHES,
      data: maximumBatch,
    });
    const oversizedResult = PushDeliveryRuntimeJobSchema.safeParse({
      name: PushDeliveryJobName.DELIVER_DISPATCHES,
      data: oversizedBatch,
    });

    // Then
    expect(emptyResult.success).toBe(false);
    expect(maximumResult.success).toBe(true);
    expect(oversizedResult.success).toBe(false);
  });

  it("같은 dispatchId가 batch에 두 번 포함되면 generation이 달라도 거부한다", () => {
    // Given
    const duplicatedDispatchBatch = [publication(7, 1), publication(7, 2)];

    // When
    const result = PushDeliveryRuntimeJobSchema.safeParse({
      name: PushDeliveryJobName.DELIVER_DISPATCHES,
      data: duplicatedDispatchBatch,
    });

    // Then
    // 하나의 job에서 같은 dispatch를 중복 처리하지 않음
    expect(result.success).toBe(false);
  });

  it("dead-letter queue는 delivery payload만 허용하고 relay payload를 거부한다", () => {
    // When
    const deliveryResult = PushDeliveryDeadLetterJobSchema.safeParse({
      name: PushDeliveryJobName.DELIVER_DISPATCHES,
      data: [publication(1)],
    });
    const relayResult = PushDeliveryDeadLetterJobSchema.safeParse({
      name: PushDeliveryJobName.RELAY_OUTBOX,
      data: {},
    });

    // Then
    expect(deliveryResult.success).toBe(true);
    expect(relayResult.success).toBe(false);
  });
});
