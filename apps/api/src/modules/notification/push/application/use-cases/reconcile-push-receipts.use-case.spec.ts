import { FakePushProvider } from "#test/doubles/notification/fake-push-provider";
import { InMemoryPushTokenRepository } from "#test/doubles/notification/in-memory-push-token.repository";
import { PassThroughNotificationCache } from "#test/doubles/notification/pass-through-notification-cache";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createPushTokenFixture } from "#test/fixtures/notification/push-token.fixture";

import type { PushFailureKind } from "../../domain/push-failure-kind.constants.js";
import {
  PUSH_RECEIPT_FAILURE_MIN_RECEIPTS,
  PUSH_RECEIPT_POLICY,
  type PushReceiptCheckWindow,
} from "../../domain/push-receipt.domain-service.js";
import type { PushReceiptResult } from "../ports/push-provider.port.js";
import type { InvalidPushToken } from "../ports/push-receipt.repository.port.js";
import type { PushTokenRepositoryPort } from "../ports/push-token.repository.port.js";
import { PushAlerts } from "../push.alerts.js";
import { ReconcilePushReceiptsUseCase } from "./reconcile-push-receipts.use-case.js";

const NOW = Temporal.Instant.from("2026-11-10T03:00:00.000Z");

type ReceiptRepository = ConstructorParameters<
  typeof ReconcilePushReceiptsUseCase
>[0]["pushReceiptRepository"];

class StubReceiptRepository implements ReceiptRepository {
  pendingTicketIds: string[] = [];
  invalidByTicketId = new Map<string, InvalidPushToken>();
  readonly recorded: string[][] = [];
  readonly windows: PushReceiptCheckWindow[] = [];
  readonly expiredBefore: Date[] = [];
  expiredCount = 0;

  async findPendingTicketIds(window: PushReceiptCheckWindow, limit: number): Promise<string[]> {
    this.windows.push(window);
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

  async expireUnreceipted(acceptedBefore: Date): Promise<number> {
    this.expiredBefore.push(acceptedBefore);
    return this.expiredCount;
  }
}

function setup(
  options: {
    readonly pushTokenRepository?: Pick<PushTokenRepositoryPort, "deactivateInvalidTokens">;
    readonly pushProvider?: FakePushProvider;
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
  const alert = new RecordingOperationalAlert();
  const useCase = new ReconcilePushReceiptsUseCase({
    pushReceiptRepository: repository,
    pushTokenRepository: options.pushTokenRepository ?? pushTokenRepository,
    pushProvider: options.pushProvider ?? new FakePushProvider(),
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
    alert,
  });
  return { useCase, repository, pushTokenRepository, cache, transactionEvents, logger, alert };
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
      alert: new RecordingOperationalAlert(),
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

  it("수락한 지 15분이 지난 ticket만 조회하고 24시간이 지난 ticket은 결과 미상으로 닫는다", async () => {
    // Given: 5분마다 도는 실행이라도 Expo 권장(발송 약 15분 뒤)보다 이른 ticket은 묻지 않는다
    const { useCase, repository } = setup();
    repository.pendingTicketIds = ["ticket-1"];

    // When
    await useCase.execute();

    // Then
    expect(repository.windows[0]).toEqual({
      acceptedAfter: new Date("2026-11-09T03:00:00.000Z"),
      acceptedBefore: new Date("2026-11-10T02:45:00.000Z"),
      checkedBefore: new Date("2026-11-10T02:45:00.000Z"),
    });
    expect(repository.expiredBefore).toEqual([new Date("2026-11-09T03:00:00.000Z")]);
  });
});

describe("ReconcilePushReceiptsUseCase — 공급자 쪽 실패 비율 경보", () => {
  function receiptsWith(failures: number, total: number, kind: PushFailureKind) {
    const pushProvider = new FakePushProvider();
    pushProvider.receipts = async (ids) =>
      ids.map((ticketId, index): PushReceiptResult =>
        index < failures
          ? { ticketId, status: "failed", failure: { kind } }
          : { ticketId, status: "delivered" },
      );
    const fixture = setup({ pushProvider });
    fixture.repository.pendingTicketIds = ticketIds(total);
    return fixture;
  }

  it("한 실행에서 받은 receipt의 공급자 실패가 20% 이상이면 가장 많은 실패 종류와 함께 경보한다", async () => {
    // Given - 받은 25건 중 5건이 자격 증명 문제로 거절됐다
    const { useCase, alert } = receiptsWith(5, 25, "PROVIDER_REJECTED");

    // When
    await useCase.execute();

    // Then
    expect(alert.alerts).toEqual([
      {
        ...PushAlerts.RECEIPT_FAILURE_RATIO_HIGH,
        tags: { topFailureKind: "PROVIDER_REJECTED" },
        details: { receivedCount: 25, providerFailureCount: 5 },
      },
    ]);
  });

  it("앱 삭제로 생긴 기기 미등록은 실패 비율에 세지 않는다", async () => {
    // Given
    const { useCase, alert } = receiptsWith(25, 25, "DEVICE_UNREGISTERED");

    // When
    await useCase.execute();

    // Then
    expect(alert.alerts).toEqual([]);
  });

  it("받은 receipt가 최소 표본보다 적으면 모두 실패여도 판정하지 않는다", async () => {
    // Given
    const total = PUSH_RECEIPT_FAILURE_MIN_RECEIPTS - 1;
    const { useCase, alert } = receiptsWith(total, total, "PROVIDER_REJECTED");

    // When
    await useCase.execute();

    // Then
    expect(alert.alerts).toEqual([]);
  });
});
