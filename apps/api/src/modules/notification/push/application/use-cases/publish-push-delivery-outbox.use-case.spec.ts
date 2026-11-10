import { Logger } from "@nestjs/common";
import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { DateClock } from "#test/doubles/platform/date-clock";
import { createUnitOfWorkMock } from "#test/mocks/ports/unit-of-work.mock";

import { type PushDeliveryJobEnqueuerPort } from "../ports/push-delivery-job-enqueuer.port.js";
import { type PushDeliveryOutboxRepositoryPort } from "../ports/push-delivery-outbox.repository.port.js";
import { PublishPushDeliveryOutboxUseCase } from "./publish-push-delivery-outbox.use-case.js";

function createOutboxMock(): PushDeliveryOutboxRepositoryPort {
  return {
    claimByDispatchIds: vi.fn(),
    claimAvailable: vi.fn(),
    markPublished: vi.fn(),
    defer: vi.fn(),
    recoverStaleProcessing: vi.fn(),
  };
}

function createEnqueuerMock(): PushDeliveryJobEnqueuerPort {
  return { enqueueDeliveries: vi.fn() };
}

function transactional(publications: readonly { dispatchId: number; publishAttempt: number }[]) {
  return publications.map((publication) => ({ ...publication, lane: "TRANSACTIONAL" as const }));
}

describe("PublishPushDeliveryOutboxUseCase — outbox job 발행", () => {
  let useCase: PublishPushDeliveryOutboxUseCase;
  let outbox: Mocked<ConstructorParameters<typeof PublishPushDeliveryOutboxUseCase>[0]["outbox"]>;
  let enqueuer: Mocked<
    ConstructorParameters<typeof PublishPushDeliveryOutboxUseCase>[0]["enqueuer"]
  >;

  beforeEach(async () => {
    const publishPushDeliveryOutboxDependencies = mockDeep<
      ConstructorParameters<typeof PublishPushDeliveryOutboxUseCase>[0]
    >({
      outbox: createOutboxMock(),
      enqueuer: createEnqueuerMock(),
      unitOfWork: createUnitOfWorkMock(),
      clock: new DateClock(),
    });
    const unit = new PublishPushDeliveryOutboxUseCase(publishPushDeliveryOutboxDependencies);

    useCase = unit;
    outbox = publishPushDeliveryOutboxDependencies.outbox;
    enqueuer = publishPushDeliveryOutboxDependencies.enqueuer;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("available relay는 한 job의 최대 100건만 claim하고 발행 완료 수를 반환한다", async () => {
    const publications = [{ dispatchId: 31, publishAttempt: 1 }];
    outbox.claimAvailable.mockResolvedValue(transactional(publications));
    outbox.markPublished.mockResolvedValue(1);

    await expect(useCase.execute({ kind: "available", limit: 500 })).resolves.toBe(1);

    expect(outbox.claimAvailable).toHaveBeenCalledWith({ limit: 100, lockedAt: expect.any(Date) });
    expect(enqueuer.enqueueDeliveries).toHaveBeenCalledWith(publications, "TRANSACTIONAL");
    expect(outbox.markPublished).toHaveBeenCalledWith(publications, expect.any(Date));
  });

  it("지정 dispatch가 비어 있으면 DB와 queue를 호출하지 않는다", async () => {
    await expect(useCase.execute({ kind: "dispatches", dispatchIds: [] })).resolves.toBe(0);

    expect(outbox.claimByDispatchIds).not.toHaveBeenCalled();
    expect(enqueuer.enqueueDeliveries).not.toHaveBeenCalled();
  });

  it("enqueue가 거부되면 같은 generation을 backoff 시점까지 defer한다", async () => {
    // Given - claim 성공 후 queue backend가 enqueue를 거부
    const now = new Date("2026-08-29T00:00:00.000Z");
    vi.useFakeTimers({ toFake: ["Date"], now });
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const publications = [{ dispatchId: 41, publishAttempt: 2 }];
    outbox.claimByDispatchIds.mockResolvedValue(transactional(publications));
    enqueuer.enqueueDeliveries.mockRejectedValue(new Error("queue unavailable"));
    outbox.defer.mockResolvedValue(1);

    // When - 지정 dispatch fast path 발행
    const publishedCount = await useCase.execute({
      kind: "dispatches",
      dispatchIds: [41],
    });

    // Then - capped backoff로 PENDING 복구하고 published로 표시하지 않음
    expect(outbox.defer).toHaveBeenCalledWith({
      publications,
      availableAt: new Date(now.getTime() + 2_000),
      error: "queue unavailable",
    });
    expect(outbox.markPublished).not.toHaveBeenCalled();
    expect(publishedCount).toBe(0);
  });

  it("queue가 문자열 오류를 반환해도 안전한 메시지로 정규화해 defer한다", async () => {
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const publications = [{ dispatchId: 42, publishAttempt: 1 }];
    outbox.claimByDispatchIds.mockResolvedValue(transactional(publications));
    enqueuer.enqueueDeliveries.mockRejectedValue("queue unavailable");

    await useCase.execute({ kind: "dispatches", dispatchIds: [42] });

    expect(outbox.defer).toHaveBeenCalledWith(
      expect.objectContaining({ publications, error: "queue unavailable" }),
    );
  });

  it("enqueue 성공 뒤 publish mark가 실패하면 generation을 defer하지 않는다", async () => {
    // Given - queue가 job을 수락했지만 publish mark 저장이 일시적으로 실패
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const publications = [{ dispatchId: 52, publishAttempt: 3 }];
    outbox.claimByDispatchIds.mockResolvedValue(transactional(publications));
    enqueuer.enqueueDeliveries.mockResolvedValue(undefined);
    outbox.markPublished.mockRejectedValue(new Error("commit uncertain"));

    // When - 지정 dispatch 발행
    const publishedCount = await useCase.execute({
      kind: "dispatches",
      dispatchIds: [52],
    });

    // Then - 이미 enqueue된 generation은 lease recovery에 맡기고 되돌리지 않음
    expect(outbox.markPublished).toHaveBeenCalledWith(publications, expect.any(Date));
    expect(outbox.defer).not.toHaveBeenCalled();
    expect(publishedCount).toBe(0);
  });

  it("거래성과 마케팅 publication은 차선별 작업으로 나눠 발행하고 key 입력에는 차선을 싣지 않는다", async () => {
    // Given - 한 claim에 두 차선이 섞여 있다
    outbox.claimAvailable.mockResolvedValue([
      { dispatchId: 61, publishAttempt: 1, lane: "MARKETING" },
      { dispatchId: 62, publishAttempt: 1, lane: "TRANSACTIONAL" },
      { dispatchId: 63, publishAttempt: 2, lane: "MARKETING" },
    ]);
    outbox.markPublished.mockImplementation(async (publications) => publications.length);

    // When
    const publishedCount = await useCase.execute({ kind: "available", limit: 100 });

    // Then - 거래성 작업을 먼저 넣고 각 작업은 한 차선만 담는다
    expect(publishedCount).toBe(3);
    expect(enqueuer.enqueueDeliveries.mock.calls).toEqual([
      [[{ dispatchId: 62, publishAttempt: 1 }], "TRANSACTIONAL"],
      [
        [
          { dispatchId: 61, publishAttempt: 1 },
          { dispatchId: 63, publishAttempt: 2 },
        ],
        "MARKETING",
      ],
    ]);
  });
});
