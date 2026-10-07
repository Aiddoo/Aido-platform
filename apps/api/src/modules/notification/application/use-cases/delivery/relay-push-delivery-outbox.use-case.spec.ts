import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createUnitOfWorkMock } from "#test/mocks/ports/unit-of-work.mock";

import { type PushDeliveryLifecycleRepositoryPort } from "../../ports/delivery/push-delivery-lifecycle.repository.port.js";
import { type PushDeliveryOutboxRepositoryPort } from "../../ports/delivery/push-delivery-outbox.repository.port.js";
import { RelayPushDeliveryOutbox } from "./relay-push-delivery-outbox.use-case.js";

function createOutboxMock(): PushDeliveryOutboxRepositoryPort {
  return {
    claimByDispatchIds: vi.fn(),
    claimAvailable: vi.fn(),
    markPublished: vi.fn(),
    defer: vi.fn(),
    recoverStaleProcessing: vi.fn(),
  };
}

function createLifecycleMock(): PushDeliveryLifecycleRepositoryPort {
  return {
    claim: vi.fn(),
    markRateLimitReserved: vi.fn(),
    reopenAfterFinalClaimFailure: vi.fn(),
    reopenFailedPublications: vi.fn(),
    finalizeSkipped: vi.fn(),
    finalizeResults: vi.fn(),
    release: vi.fn(),
    recoverStaleProcessing: vi.fn(),
  };
}

describe("RelayPushDeliveryOutbox — stale recovery와 relay", () => {
  let useCase: RelayPushDeliveryOutbox;
  let outbox: Mocked<ConstructorParameters<typeof RelayPushDeliveryOutbox>[0]["outbox"]>;
  let lifecycle: Mocked<ConstructorParameters<typeof RelayPushDeliveryOutbox>[0]["lifecycle"]>;
  let publishOutbox: Mocked<
    ConstructorParameters<typeof RelayPushDeliveryOutbox>[0]["publishOutbox"]
  >;

  beforeEach(async () => {
    const relayPushDeliveryOutboxDependencies = mockDeep<
      ConstructorParameters<typeof RelayPushDeliveryOutbox>[0]
    >({
      outbox: createOutboxMock(),
      lifecycle: createLifecycleMock(),
      unitOfWork: createUnitOfWorkMock(),
    });
    const unit = new RelayPushDeliveryOutbox(relayPushDeliveryOutboxDependencies);

    useCase = unit;
    outbox = relayPushDeliveryOutboxDependencies.outbox;
    lifecycle = relayPushDeliveryOutboxDependencies.lifecycle;
    publishOutbox = relayPushDeliveryOutboxDependencies.publishOutbox;
    lifecycle.recoverStaleProcessing.mockResolvedValue(0);
    outbox.recoverStaleProcessing.mockResolvedValue(0);
    publishOutbox.execute.mockResolvedValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stale delivery와 outbox lease를 먼저 복구한 뒤 available batch를 발행한다", async () => {
    // Given - 고정된 relay 실행 시각
    const now = new Date("2026-08-29T12:00:00.000Z");
    const processingStaleBefore = new Date(now.getTime() - 15 * 60_000);
    vi.useFakeTimers({ toFake: ["Date"], now });

    // When - 주기 relay 실행
    await useCase.execute();

    // Then - 외부 전송 latency를 고려한 15분 lease만 복구한다.
    // PUBLISHED generation은 시간 경과만으로 무효화하지 않는다.
    expect(lifecycle.recoverStaleProcessing).toHaveBeenCalledWith(processingStaleBefore);
    expect(outbox.recoverStaleProcessing).toHaveBeenCalledWith(processingStaleBefore);
    expect(publishOutbox.execute).toHaveBeenCalledWith({ kind: "available", limit: 100 });
    expect(publishOutbox.execute).toHaveBeenCalledTimes(1);
  });

  it("항상 가득 찬 backlog도 trigger당 최대 10개 batch로 제한한다", async () => {
    // Given - 매번 100개가 발행되는 큰 backlog
    publishOutbox.execute.mockResolvedValue(100);

    // When - 단일 relay trigger 실행
    await useCase.execute();

    // Then - 한 worker가 queue를 독점하지 않도록 1,000개에서 양보
    expect(publishOutbox.execute).toHaveBeenCalledTimes(10);
  });
});
