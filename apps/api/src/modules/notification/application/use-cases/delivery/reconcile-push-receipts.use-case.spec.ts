import { StubPushTokenCache } from "#test/mocks/stub-push-token-cache";

import { PUSH_RECEIPT_POLICY } from "../../policies/delivery/push-receipt.policy.js";
import type { PushReceiptResult } from "../../ports/delivery/push-provider.port.js";
import type { InvalidPushToken } from "../../ports/delivery/push-receipt.repository.port.js";
import { ReconcilePushReceipts } from "./reconcile-push-receipts.use-case.js";

type ReceiptRepository = ConstructorParameters<
  typeof ReconcilePushReceipts
>[0]["pushReceiptRepository"];

class StubReceiptRepository implements ReceiptRepository {
  pendingTicketIds: string[] = [];
  invalidByTicketId = new Map<string, InvalidPushToken>();
  readonly recorded: string[][] = [];
  expiredCount = 0;

  async findPendingTicketIds(_window: unknown, limit: number): Promise<string[]> {
    return this.pendingTicketIds.slice(0, limit);
  }

  async recordPushReceipts(input: {
    readonly requestedTicketIds: readonly string[];
    readonly results: readonly PushReceiptResult[];
  }): Promise<InvalidPushToken[]> {
    this.recorded.push([...input.requestedTicketIds]);
    const requested = new Set(input.requestedTicketIds);
    this.pendingTicketIds = this.pendingTicketIds.filter((ticketId) => !requested.has(ticketId));
    return input.requestedTicketIds.flatMap((ticketId) => {
      const invalid = this.invalidByTicketId.get(ticketId);
      return invalid == null ? [] : [invalid];
    });
  }

  async expireUnreceipted(): Promise<number> {
    return this.expiredCount;
  }
}

function setup(options: { readonly deactivate?: () => Promise<{ count: number }> } = {}) {
  const repository = new StubReceiptRepository();
  const cache = new StubPushTokenCache();
  const deactivated: string[][] = [];
  const transactionEvents: string[] = [];
  const logs: unknown[] = [];
  const useCase = new ReconcilePushReceipts({
    pushReceiptRepository: repository,
    pushTokenRepository: {
      deactivateInvalidTokens: async (tokens) => {
        deactivated.push(tokens);
        return options.deactivate?.() ?? { count: tokens.length };
      },
    },
    pushProvider: {
      getReceipts: async (ticketIds) =>
        ticketIds.map((ticketId) => ({ ticketId, status: "delivered" as const })),
    },
    cache,
    unitOfWork: {
      async run(work) {
        transactionEvents.push("begin");
        try {
          const result = await work();
          transactionEvents.push("commit");
          return result;
        } catch (error) {
          transactionEvents.push("rollback");
          throw error;
        }
      },
    },
    logger: { log: (entry) => logs.push(entry), warn: (entry) => logs.push(entry) },
  });
  return { useCase, repository, cache, deactivated, transactionEvents, logs };
}

function ticketIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `ticket-${index}`);
}

describe("ReconcilePushReceipts — receipt 반영", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("한 실행 안에서 남은 ticket을 배치 단위로 모두 반영한다", async () => {
    // Given: 한 배치보다 많은 ticket이 밀려 있다
    const { useCase, repository, logs } = setup();
    repository.pendingTicketIds = ticketIds(PUSH_RECEIPT_POLICY.batchSize * 2 + 10);
    repository.expiredCount = 3;

    // When
    await useCase.execute();

    // Then
    expect(repository.recorded.map((batch) => batch.length)).toEqual([
      PUSH_RECEIPT_POLICY.batchSize,
      PUSH_RECEIPT_POLICY.batchSize,
      10,
    ]);
    expect(repository.pendingTicketIds).toHaveLength(0);
    expect(logs).toContainEqual(
      expect.objectContaining({ expired: 3, requested: PUSH_RECEIPT_POLICY.batchSize * 2 + 10 }),
    );
  });

  it("실행 예산을 넘기면 남은 ticket은 다음 실행에 맡긴다", async () => {
    // Given
    vi.useFakeTimers({ toFake: ["Date"] });
    const repository = new StubReceiptRepository();
    repository.pendingTicketIds = ticketIds(PUSH_RECEIPT_POLICY.batchSize * 3);
    const getReceipts = vi.fn(async (ids: readonly string[]) => {
      vi.setSystemTime(Date.now() + PUSH_RECEIPT_POLICY.runBudgetMs);
      return ids.map((ticketId) => ({ ticketId, status: "delivered" as const }));
    });
    const budgeted = new ReconcilePushReceipts({
      pushReceiptRepository: repository,
      pushTokenRepository: { deactivateInvalidTokens: async () => ({ count: 0 }) },
      pushProvider: { getReceipts },
      cache: new StubPushTokenCache(),
      unitOfWork: { run: (work) => work() },
      logger: { log: () => undefined, warn: () => undefined },
    });

    // When
    await budgeted.execute();

    // Then
    expect(getReceipts).toHaveBeenCalledTimes(1);
    expect(repository.pendingTicketIds).toHaveLength(PUSH_RECEIPT_POLICY.batchSize * 2);
  });

  it("무효 토큰을 같은 transaction에서 끄고 commit 뒤 수신자 캐시를 한 번 지운다", async () => {
    // Given
    const { useCase, repository, cache, deactivated, transactionEvents } = setup();
    repository.pendingTicketIds = ["ticket-1", "ticket-2"];
    repository.invalidByTicketId.set("ticket-1", { token: "token-1", userId: "user-1" });
    repository.invalidByTicketId.set("ticket-2", { token: "token-2", userId: "user-1" });
    cache.entries.set("user-1", ["token-1", "token-2"]);

    // When
    await useCase.execute();

    // Then
    expect(deactivated).toEqual([["token-1", "token-2"]]);
    expect(transactionEvents).toEqual(["begin", "commit", "begin", "commit"]);
    expect(cache.entries.has("user-1")).toBe(false);
  });

  it("토큰 비활성화가 실패하면 receipt 기록도 rollback되도록 오류를 전파한다", async () => {
    // Given
    const { useCase, repository, transactionEvents } = setup({
      deactivate: async () => {
        throw new Error("deactivate failed");
      },
    });
    repository.pendingTicketIds = ["ticket-1"];
    repository.invalidByTicketId.set("ticket-1", { token: "token-1", userId: "user-1" });

    // When / Then
    await expect(useCase.execute()).rejects.toThrow("deactivate failed");
    expect(transactionEvents.at(-1)).toBe("rollback");
  });
});
