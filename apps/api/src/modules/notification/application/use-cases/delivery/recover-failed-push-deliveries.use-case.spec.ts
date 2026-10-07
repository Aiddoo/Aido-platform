import { mockDeep } from "vitest-mock-extended";

import { createUnitOfWorkMock } from "#test/mocks/ports/index";

import { RecoverFailedPushDeliveries } from "./recover-failed-push-deliveries.use-case.js";

describe("RecoverFailedPushDeliveries", () => {
  it("DLQ publication 중 현재 PENDING dispatch와 matching generation subset만 repository에 위임한다", async () => {
    const recoverFailedPushDeliveriesDependencies = mockDeep<
      ConstructorParameters<typeof RecoverFailedPushDeliveries>[0]
    >({
      unitOfWork: createUnitOfWorkMock(),
    });
    recoverFailedPushDeliveriesDependencies.lifecycle.reopenFailedPublications.mockResolvedValue(1);
    const unit = new RecoverFailedPushDeliveries(recoverFailedPushDeliveriesDependencies);
    const lifecycle = recoverFailedPushDeliveriesDependencies.lifecycle;
    const publications = [
      { dispatchId: 11, publishAttempt: 2 },
      { dispatchId: 12, publishAttempt: 4 },
    ];

    await expect(unit.execute({ publications })).resolves.toBe(1);
    expect(lifecycle.reopenFailedPublications).toHaveBeenCalledWith({
      publications,
      availableAt: expect.any(Date),
      error: "DELIVERY_RUNTIME_RETRIES_EXHAUSTED",
    });
  });
});
