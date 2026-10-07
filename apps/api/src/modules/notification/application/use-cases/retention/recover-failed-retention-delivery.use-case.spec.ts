import { mockDeep } from "vitest-mock-extended";

import { createRetentionRepositoryMock, createUnitOfWorkMock } from "#test/mocks/ports/index";

import { RecoverFailedRetentionDelivery } from "./recover-failed-retention-delivery.use-case.js";

describe("RecoverFailedRetentionDelivery", () => {
  it("DLQ는 matching generation의 unclaimed retention publication만 reopen하도록 위임한다", async () => {
    const recoverFailedRetentionDeliveryDependencies = mockDeep<
      ConstructorParameters<typeof RecoverFailedRetentionDelivery>[0]
    >({ repository: createRetentionRepositoryMock(), unitOfWork: createUnitOfWorkMock() });
    const unit = new RecoverFailedRetentionDelivery(recoverFailedRetentionDeliveryDependencies);
    const repository = recoverFailedRetentionDeliveryDependencies.repository;
    repository.reopenUnclaimedDispatch.mockResolvedValue(true);

    await expect(unit.execute({ outboxId: "outbox-1", publishAttempt: 3 })).resolves.toBe(true);
    expect(repository.reopenUnclaimedDispatch).toHaveBeenCalledWith({
      outboxId: "outbox-1",
      publishAttempt: 3,
      availableAt: expect.any(Date),
      reason: "RETENTION_RUNTIME_RETRIES_EXHAUSTED",
    });
  });
});
