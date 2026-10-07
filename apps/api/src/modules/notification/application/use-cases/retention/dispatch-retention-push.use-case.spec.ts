import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createRetentionRepositoryMock, createUnitOfWorkMock } from "#test/mocks/ports/index";

import { type RetentionPushSenderPort } from "../../ports/retention/retention-push-sender.port.js";
import {
  type RetentionDispatchCandidate,
  type RetentionRepositoryPort,
} from "../../ports/retention/retention.repository.port.js";
import { DispatchRetentionPush } from "./dispatch-retention-push.use-case.js";

describe("DispatchRetentionPush — 멱등 푸시 처리", () => {
  const execution = {
    outboxId: "outbox-1",
    publishAttempt: 1,
    processingJobId: "retention-job-1",
    processingJobAttempt: 1,
    isFinalAttempt: false,
  } as const;
  let useCase: DispatchRetentionPush;
  let repository: Mocked<RetentionRepositoryPort>;
  let sender: Mocked<RetentionPushSenderPort>;

  beforeEach(async () => {
    const dispatchRetentionPushDependencies = mockDeep<
      ConstructorParameters<typeof DispatchRetentionPush>[0]
    >({
      repository: createRetentionRepositoryMock(),
      sender: { isEligible: vi.fn(), reserveRateLimit: vi.fn(), send: vi.fn() },
      config: { enabled: true, treatmentPercent: 50 },
      unitOfWork: createUnitOfWorkMock(),
    });
    const unit = new DispatchRetentionPush(dispatchRetentionPushDependencies);
    useCase = unit;
    repository = dispatchRetentionPushDependencies.repository;
    sender = dispatchRetentionPushDependencies.sender;
    repository.markRateLimitReserved.mockResolvedValue(true);
    sender.reserveRateLimit.mockResolvedValue(true);
  });

  function candidate(): RetentionDispatchCandidate {
    return {
      fence: {
        outboxId: "outbox-1",
        dispatchId: 1,
        publishAttempt: 1,
        processingJobId: "retention-job-1",
        deliveryAttemptCount: 1,
      },
      outboxId: "outbox-1",
      dispatchId: 1,
      notificationId: 2,
      userId: "new-user",
      title: "title",
      body: "body",
      actionUrl: "/feed",
      campaignKey: "onboarding_v2_d7",
      variantId: "d1_no_todo",
      timezone: "Asia/Seoul",
      pushEnabled: true,
      nightPushEnabled: false,
      marketingPushAgreedAt: new Date(),
      rateLimitReserved: false,
      tokens: [{ id: 1, token: "fake-token" }],
    };
  }

  it("이미 다른 worker가 claim한 중복 job은 전송하지 않는다", async () => {
    repository.claimDispatch.mockResolvedValue(null);

    await useCase.execute(execution);

    expect(sender.send).not.toHaveBeenCalled();
  });

  it("kill switch가 꺼지면 outbox를 보류해 재활성화 후 다시 처리할 수 있다", async () => {
    const dispatchRetentionPushDependencies = mockDeep<
      ConstructorParameters<typeof DispatchRetentionPush>[0]
    >({
      repository: createRetentionRepositoryMock(),
      sender: { isEligible: vi.fn(), reserveRateLimit: vi.fn(), send: vi.fn() },
      config: { enabled: false, treatmentPercent: 50 },
      unitOfWork: createUnitOfWorkMock(),
    });
    const unit = new DispatchRetentionPush(dispatchRetentionPushDependencies);
    const disabledRepository = dispatchRetentionPushDependencies.repository;

    await unit.execute(execution);

    expect(disabledRepository.deferOutbox).toHaveBeenCalledWith({
      outboxId: "outbox-1",
      publishAttempt: 1,
      availableAt: expect.any(Date),
    });
  });

  it("전송 성공 결과를 dispatch attempt 저장 포트에 전달한다", async () => {
    const claimed = candidate();
    const results = [{ token: "fake-token", success: true, ticketId: "ticket" }];
    repository.claimDispatch.mockResolvedValue(claimed);
    sender.isEligible.mockReturnValue(true);
    sender.send.mockResolvedValue(results);

    await useCase.execute(execution);

    expect(repository.recordDeliveryResults).toHaveBeenCalledWith(claimed.fence, results);
  });

  it("provider 오류 시 dispatch를 PENDING으로 되돌리고 BullMQ 재시도에 위임한다", async () => {
    repository.claimDispatch.mockResolvedValue(candidate());
    sender.isEligible.mockReturnValue(true);
    sender.send.mockRejectedValue(new Error("expo down"));

    await expect(useCase.execute(execution)).rejects.toThrow("expo down");
    expect(repository.releaseDispatchForRetry).toHaveBeenCalledWith({
      fence: candidate().fence,
      reason: "expo down",
      availableAt: expect.any(Date),
      hasExhaustedRetries: false,
    });
  });

  it("새 publication generation도 저장된 rate 예약은 재사용하고 현재 eligibility만 다시 본다", async () => {
    const claimed = { ...candidate(), rateLimitReserved: true };
    repository.claimDispatch.mockResolvedValue(claimed);
    sender.isEligible.mockReturnValue(true);
    sender.send.mockResolvedValue([{ token: "fake-token", success: true }]);

    await useCase.execute({ ...execution, publishAttempt: 7 });

    expect(sender.isEligible).toHaveBeenCalledWith(claimed, expect.any(Date));
    expect(sender.reserveRateLimit).not.toHaveBeenCalled();
    expect(repository.markRateLimitReserved).not.toHaveBeenCalled();
    expect(sender.send).toHaveBeenCalledWith(claimed);
  });

  it("rate 예약 DB marker가 실패하면 provider 전에 release하고 오류를 보존한다", async () => {
    const claimed = candidate();
    repository.claimDispatch.mockResolvedValue(claimed);
    repository.markRateLimitReserved.mockResolvedValue(false);
    sender.isEligible.mockReturnValue(true);

    await expect(useCase.execute(execution)).rejects.toThrow(
      "Retention rate-limit reservation fence mismatch",
    );
    expect(sender.send).not.toHaveBeenCalled();
    expect(repository.releaseDispatchForRetry).toHaveBeenCalledWith(
      expect.objectContaining({ fence: claimed.fence }),
    );
  });

  it("initial claim 오류는 중간 attempt에는 reopen하지 않고 마지막 attempt에만 exact recovery한다", async () => {
    const claimError = new Error("retention claim unavailable");
    repository.claimDispatch.mockRejectedValueOnce(claimError);
    await expect(useCase.execute(execution)).rejects.toBe(claimError);
    expect(repository.reopenUnclaimedDispatch).not.toHaveBeenCalled();

    repository.claimDispatch.mockRejectedValueOnce(claimError);
    repository.reopenUnclaimedDispatch.mockResolvedValueOnce(true);
    await expect(useCase.execute({ ...execution, isFinalAttempt: true })).rejects.toBe(claimError);
    expect(repository.reopenUnclaimedDispatch).toHaveBeenCalledWith({
      outboxId: "outbox-1",
      publishAttempt: 1,
      availableAt: expect.any(Date),
      reason: claimError.message,
    });
  });

  it("initial claim recovery DB 오류가 나도 원본 claim 오류를 보존해 DLQ로 보낸다", async () => {
    const claimError = new Error("retention claim unavailable");
    repository.claimDispatch.mockRejectedValueOnce(claimError);
    repository.reopenUnclaimedDispatch.mockRejectedValueOnce(new Error("recovery unavailable"));

    await expect(useCase.execute({ ...execution, isFinalAttempt: true })).rejects.toBe(claimError);
  });
});
