import { FakePushProvider } from "#test/doubles/notification/fake-push-provider";
import { InMemoryPushTokenRepository } from "#test/doubles/notification/in-memory-push-token.repository";
import { PassThroughNotificationCache } from "#test/doubles/notification/pass-through-notification-cache";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createPushTokenFixture } from "#test/fixtures/notification/push-token.fixture";

import { PUSH_RECEIPT_POLICY } from "../../domain/push-receipt.domain-service.js";
import type { PushReceiptResult } from "../ports/push-provider.port.js";
import type { InvalidPushToken } from "../ports/push-receipt.repository.port.js";
import type { PushTokenRepositoryPort } from "../ports/push-token.repository.port.js";
import { ReconcilePushReceiptsUseCase } from "./reconcile-push-receipts.use-case.js";

const NOW = Temporal.Instant.from("2026-11-10T03:00:00.000Z");

type ReceiptRepository = ConstructorParameters<
  typeof ReconcilePushReceiptsUseCase
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

function setup(
  options: {
    readonly pushTokenRepository?: Pick<PushTokenRepositoryPort, "deactivateInvalidTokens">;
  } = {},
) {
  const repository = new StubReceiptRepository();
  const pushTokenRepository = new InMemoryPushTokenRepository([
    createPushTokenFixture({ id: 1, userId: "user-1", token: "token-1", deviceId: "device-1" }),
    createPushTokenFixture({ id: 2, userId: "user-1", token: "token-2", deviceId: "device-2" }),
    createPushTokenFixture({ id: 3, userId: "user-2", token: "token-3", deviceId: "device-3" }),
  ]);
  const cache = new PassThroughNotificationCache();
  const transactionEvents: string[] = [];
  const logger = new SilentLogger();
  const useCase = new ReconcilePushReceiptsUseCase({
    pushReceiptRepository: repository,
    pushTokenRepository: options.pushTokenRepository ?? pushTokenRepository,
    pushProvider: new FakePushProvider(),
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
    clock: new FixedClock(NOW),
    logger,
  });
  return { useCase, repository, pushTokenRepository, cache, transactionEvents, logger };
}

function ticketIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `ticket-${index}`);
}

describe("ReconcilePushReceiptsUseCase — receipt 반영", () => {
  it("한 실행 안에서 남은 ticket을 배치 단위로 모두 반영한다", async () => {
    // Given - 한 배치보다 많은 ticket이 밀려 있다
    const { useCase, repository, logger } = setup();
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
    expect(logger.messages).toContainEqual(
      expect.objectContaining({ expired: 3, requested: PUSH_RECEIPT_POLICY.batchSize * 2 + 10 }),
    );
  });

  it("실행 예산을 넘기면 남은 ticket은 다음 실행에 맡긴다", async () => {
    // Given
    const clock = new FixedClock(NOW);
    const repository = new StubReceiptRepository();
    repository.pendingTicketIds = ticketIds(PUSH_RECEIPT_POLICY.batchSize * 3);
    const pushProvider = new FakePushProvider();
    let receiptRequests = 0;
    pushProvider.receipts = async (ids) => {
      receiptRequests += 1;
      clock.advanceBy({ milliseconds: PUSH_RECEIPT_POLICY.runBudgetMs });
      return ids.map((ticketId) => ({ ticketId, status: "delivered" }));
    };
    const budgeted = new ReconcilePushReceiptsUseCase({
      pushReceiptRepository: repository,
      pushTokenRepository: new InMemoryPushTokenRepository(),
      pushProvider,
      cache: new PassThroughNotificationCache(),
      unitOfWork: new ImmediateUnitOfWork(),
      clock,
      logger: new SilentLogger(),
    });

    // When
    await budgeted.execute();

    // Then
    expect(receiptRequests).toBe(1);
    expect(repository.pendingTicketIds).toHaveLength(PUSH_RECEIPT_POLICY.batchSize * 2);
  });

  it("무효 토큰을 같은 transaction에서 끄고 commit 뒤 수신자 캐시를 한 번 지운다", async () => {
    // Given
    const { useCase, repository, pushTokenRepository, cache, transactionEvents } = setup();
    repository.pendingTicketIds = ["ticket-1", "ticket-2"];
    repository.invalidByTicketId.set("ticket-1", { token: "token-1", userId: "user-1" });
    repository.invalidByTicketId.set("ticket-2", { token: "token-2", userId: "user-1" });

    // When
    await useCase.execute();

    // Then
    const tokens = await pushTokenRepository.findActivePushTokensByUsers(["user-1", "user-2"]);
    expect(tokens.map(({ token }) => token)).toEqual(["token-3"]);
    expect(pushTokenRepository.tokenOf("user-1", "device-1")?.updatedAt.equals(NOW)).toBe(true);
    expect(transactionEvents).toEqual(["begin", "commit", "begin", "commit"]);
    expect(cache.invalidatedPushTokenUserIds).toEqual(["user-1"]);
  });

  it("토큰 비활성화가 실패하면 receipt 기록도 rollback되도록 오류를 전파한다", async () => {
    // Given
    const { useCase, repository, cache, transactionEvents } = setup({
      pushTokenRepository: {
        deactivateInvalidTokens: async () => {
          throw new Error("deactivate failed");
        },
      },
    });
    repository.pendingTicketIds = ["ticket-1"];
    repository.invalidByTicketId.set("ticket-1", { token: "token-1", userId: "user-1" });

    // When
    const result = useCase.execute();

    // Then
    await expect(result).rejects.toThrow("deactivate failed");
    expect(transactionEvents.at(-1)).toBe("rollback");
    expect(cache.invalidatedPushTokenUserIds).toEqual([]);
  });
});
