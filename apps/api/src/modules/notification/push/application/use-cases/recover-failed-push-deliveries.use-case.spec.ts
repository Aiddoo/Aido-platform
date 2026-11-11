import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";

import type {
  PushDeliveryLifecycleRepositoryPort,
  ReopenPushDeliveriesAfterClaimFailureInput,
} from "../ports/push-delivery-lifecycle.repository.port.js";
import { RecoverFailedPushDeliveriesUseCase } from "./recover-failed-push-deliveries.use-case.js";

const NOW = Temporal.Instant.from("2026-08-29T12:00:00.000Z");

class RecordingReopenLifecycle implements Pick<
  PushDeliveryLifecycleRepositoryPort,
  "reopenFailedPublications"
> {
  readonly reopenInputs: ReopenPushDeliveriesAfterClaimFailureInput[] = [];
  reopenedCount = 0;

  async reopenFailedPublications(input: ReopenPushDeliveriesAfterClaimFailureInput) {
    this.reopenInputs.push(input);
    return this.reopenedCount;
  }
}

describe("RecoverFailedPushDeliveriesUseCase — 재시도가 끝난 발송 다시 열기", () => {
  it("DLQ publication을 한 트랜잭션에서 지금 시각·재시도 소진 사유로 다시 열고 저장소가 연 수를 돌려준다", async () => {
    // Given
    const lifecycle = new RecordingReopenLifecycle();
    lifecycle.reopenedCount = 1;
    const unitOfWork = new ImmediateUnitOfWork();
    const useCase = new RecoverFailedPushDeliveriesUseCase({
      lifecycle,
      unitOfWork,
      clock: new FixedClock(NOW),
    });
    const publications = [
      { dispatchId: 11, publishAttempt: 2 },
      { dispatchId: 12, publishAttempt: 4 },
    ];

    // When
    const reopened = await useCase.execute({ publications });

    // Then
    expect(reopened).toBe(1);
    expect(unitOfWork.runCount).toBe(1);
    expect(lifecycle.reopenInputs).toEqual([
      {
        publications,
        availableAt: NOW,
        error: "DELIVERY_RUNTIME_RETRIES_EXHAUSTED",
      },
    ]);
  });
});
