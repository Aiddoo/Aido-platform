import { mockDeep } from "vitest-mock-extended";

import { StubPushTokenCache } from "#test/mocks/stub-push-token-cache";

import { ReconcilePushReceipts } from "./reconcile-push-receipts.use-case.js";

function setup(beforeCommit?: () => Promise<void>) {
  const ports = mockDeep<ConstructorParameters<typeof ReconcilePushReceipts>[0]>();
  const cache = new StubPushTokenCache();
  const transactionEvents: string[] = [];
  const unitOfWork: ConstructorParameters<typeof ReconcilePushReceipts>[0]["unitOfWork"] = {
    async run(work) {
      transactionEvents.push("begin");
      try {
        const result = await work();
        await beforeCommit?.();
        transactionEvents.push("commit");
        return result;
      } catch (error) {
        transactionEvents.push("reject");
        throw error;
      }
    },
  };
  cache.entries.set("invalid-user", ["invalid-token-1", "invalid-token-2"]);
  cache.entries.set("other-user", ["valid-token"]);
  const useCase = new ReconcilePushReceipts({
    pushReceiptRepository: ports.pushReceiptRepository,
    pushTokenRepository: ports.pushTokenRepository,
    pushProvider: ports.pushProvider,
    logger: ports.logger,
    cache,
    unitOfWork,
  });
  return { useCase, ports, cache, transactionEvents };
}

describe("ReconcilePushReceipts — receipt 정리와 수신자 캐시", () => {
  it("무효 토큰을 기록·비활성화하고 같은 수신자의 캐시를 한 번 지운다", async () => {
    // Given
    const { useCase, ports, cache } = setup();
    const receipts = ports.pushReceiptRepository;
    receipts.findPendingPushReceipts.mockResolvedValue([
      { ticketId: "ticket-1" },
      { ticketId: "ticket-2" },
    ]);
    ports.pushProvider.getReceipts.mockResolvedValue([
      { ticketId: "ticket-1", delivered: false },
      { ticketId: "ticket-2", delivered: false },
    ]);
    receipts.recordPushReceipts.mockResolvedValue([
      { token: "invalid-token-1", userId: "invalid-user" },
      { token: "invalid-token-2", userId: "invalid-user" },
    ]);
    // When
    await useCase.execute();
    // Then - Port 대역의 캐시 상태이며 실제 Redis/토큰 rotation은 PG/Infra가 검증한다
    expect(receipts.findPendingPushReceipts).toHaveBeenCalledWith(900);
    expect(ports.pushProvider.getReceipts).toHaveBeenCalledWith(["ticket-1", "ticket-2"]);
    expect(ports.pushTokenRepository.deactivateInvalidTokens).toHaveBeenCalledWith([
      "invalid-token-1",
      "invalid-token-2",
    ]);
    expect(cache.entries.has("invalid-user")).toBe(false);
    expect(cache.entries.get("other-user")).toEqual(["valid-token"]);
    expect(cache.invalidationAttempts).toEqual(["invalid-user"]);
  });

  it("캐시 정리 실패가 이미 기록한 receipt를 다시 전송하게 만들지 않는다", async () => {
    // Given
    const { useCase, ports, cache } = setup();
    ports.pushReceiptRepository.findPendingPushReceipts.mockResolvedValue([
      { ticketId: "ticket-1" },
    ]);
    ports.pushProvider.getReceipts.mockResolvedValue([{ ticketId: "ticket-1", delivered: false }]);
    ports.pushReceiptRepository.recordPushReceipts.mockResolvedValue([
      { token: "invalid-token-1", userId: "invalid-user" },
    ]);
    cache.failForUsers.add("invalid-user");
    // When / Then
    await expect(useCase.execute()).resolves.toBeUndefined();
    expect(ports.pushReceiptRepository.recordPushReceipts).toHaveBeenCalledTimes(1);
    expect(ports.pushTokenRepository.deactivateInvalidTokens).toHaveBeenCalledTimes(1);
    expect(cache.invalidationAttempts).toEqual(["invalid-user"]);
    expect(ports.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ count: 1, errorType: "cache-invalidation" }),
    );
  });

  it("보류 receipt가 없으면 provider·토큰·캐시를 건드리지 않는다", async () => {
    // Given
    const { useCase, ports, cache } = setup();
    ports.pushReceiptRepository.findPendingPushReceipts.mockResolvedValue([]);
    // When
    await useCase.execute();
    // Then
    expect(ports.pushProvider.getReceipts).not.toHaveBeenCalled();
    expect(ports.pushReceiptRepository.recordPushReceipts).not.toHaveBeenCalled();
    expect(ports.pushTokenRepository.deactivateInvalidTokens).not.toHaveBeenCalled();
    expect(cache.invalidationAttempts).toEqual([]);
    expect(cache.entries.get("other-user")).toEqual(["valid-token"]);
  });

  it("토큰 비활성화 실패를 상위로 전달하고 다음 receipt 재시도 전에는 캐시를 지우지 않는다", async () => {
    // Given - callback 대역은 제어 흐름만 검증한다. 실제 receipt rollback은 PG 통합에서 검증한다.
    let releaseCommit!: () => void;
    let reachCommit!: () => void;
    const commitGate = new Promise<void>((resolve) => {
      releaseCommit = resolve;
    });
    const commitReached = new Promise<void>((resolve) => {
      reachCommit = resolve;
    });
    const { useCase, ports, cache, transactionEvents } = setup(async () => {
      reachCommit();
      await commitGate;
    });
    ports.pushReceiptRepository.findPendingPushReceipts.mockResolvedValue([
      { ticketId: "ticket-1" },
    ]);
    ports.pushProvider.getReceipts.mockResolvedValue([{ ticketId: "ticket-1", delivered: false }]);
    ports.pushReceiptRepository.recordPushReceipts.mockResolvedValue([
      { token: "invalid-token-1", userId: "invalid-user" },
    ]);
    const failure = new Error("synthetic-token-write-failure");
    ports.pushTokenRepository.deactivateInvalidTokens.mockRejectedValueOnce(failure);

    // When / Then - 첫 실패가 숨겨지지 않아 작업 처리기가 재시도할 수 있다.
    await expect(useCase.execute()).rejects.toBe(failure);
    expect(transactionEvents).toEqual(["begin", "reject"]);
    expect(cache.invalidationAttempts).toEqual([]);
    expect(cache.entries.has("invalid-user")).toBe(true);

    // When - PG rollback 이후에도 보류인 같은 ticket을 Port fixture로 다시 제공한다.
    const retry = useCase.execute();
    try {
      await commitReached;
      expect(transactionEvents).toEqual(["begin", "reject", "begin"]);
      expect(cache.invalidationAttempts).toEqual([]);
    } finally {
      releaseCommit();
      await retry;
    }

    // Then - 성공한 callback 이후에만 캐시를 무효화한다.
    expect(transactionEvents).toEqual(["begin", "reject", "begin", "commit"]);
    expect(ports.pushProvider.getReceipts).toHaveBeenCalledTimes(2);
    expect(ports.pushReceiptRepository.recordPushReceipts).toHaveBeenCalledTimes(2);
    expect(ports.pushTokenRepository.deactivateInvalidTokens).toHaveBeenCalledTimes(2);
    expect(cache.invalidationAttempts).toEqual(["invalid-user"]);
  });
});
