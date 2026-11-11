import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import { ACCESS_FIXTURE_NOW } from "#test/fixtures/access/access-user.fixture";
import { createQuotaLedgerFixture } from "#test/fixtures/access/quota-ledger.fixture";
import { suppressLogger } from "#test/setup/suppress-logger";

import { QUOTA_RESERVATION_TAKEOVER_AFTER_MS } from "../../domain/quotas.constants.js";
import { QuotaAbandonedRefundProcessor } from "./quota-abandoned-refund.processor.js";
import { QUOTA_ABANDONED_REFUND_QUEUE } from "./quota-abandoned-refund.queue.js";
import { QuotaAbandonedRefundScheduler } from "./quota-abandoned-refund.scheduler.js";

class FailingWorkJobQueue extends InMemoryJobQueue {
  override async work(): Promise<void> {
    throw new Error("queue unavailable");
  }
}

function setup(jobQueue: InMemoryJobQueue = new InMemoryJobQueue()) {
  const clock = new FixedClock(ACCESS_FIXTURE_NOW);
  const fixture = createQuotaLedgerFixture({}, undefined, { clock });
  const processor = new QuotaAbandonedRefundProcessor(
    fixture.refundAbandonedReservations,
    jobQueue,
  );
  return { ...fixture, clock, jobQueue, processor };
}

describe("QuotaAbandonedRefundProcessor — 멈춘 예약 정리 잡", () => {
  beforeEach(suppressLogger);

  it("옛 스케줄이 넣은 빈 payload 작업을 받아 멈춘 예약을 돌려준다", async () => {
    // Given
    const fixture = setup();
    await fixture.processor.onModuleInit();
    await fixture.ledger.reserve({
      userId: UserId.reconstitute(fixture.userId),
      feature: "AI_PARSE",
      idempotencyKey: null,
      reason: "parse-todo",
    });
    fixture.clock.advanceBy({ milliseconds: QUOTA_RESERVATION_TAKEOVER_AFTER_MS });
    await fixture.jobQueue.enqueue(QUOTA_ABANDONED_REFUND_QUEUE, {});

    // When
    await fixture.jobQueue.drain(QUOTA_ABANDONED_REFUND_QUEUE);

    // Then
    expect(fixture.quotaChargeRepository.all).toMatchObject([
      { status: "REFUNDED", refundReason: "ABANDONED" },
    ]);
  });

  it("작업자 등록이 실패하면 조용히 넘어가지 않고 기동을 멈춘다", async () => {
    // Given
    const fixture = setup(new FailingWorkJobQueue());

    // When
    const init = fixture.processor.onModuleInit();

    // Then
    await expect(init).rejects.toThrow("queue unavailable");
  });

  it("원장을 읽지 못하면 잡 재시도를 위해 다시 던진다", async () => {
    // Given
    const fixture = setup();
    const failure = new TypeError("db down");
    vi.spyOn(fixture.quotaChargeRepository, "listAbandonedReservations").mockRejectedValue(failure);

    // When
    const execution = fixture.processor.process();

    // Then
    await expect(execution).rejects.toBe(failure);
  });
});

describe("QuotaAbandonedRefundScheduler — 10분 주기 등록", () => {
  beforeEach(suppressLogger);

  it("같은 스케줄 key로 주기 실행을 등록한다", async () => {
    // Given
    const jobQueue = new InMemoryJobQueue();
    const scheduler = new QuotaAbandonedRefundScheduler(jobQueue);

    // When
    scheduler.onModuleInit();
    await scheduler.schedulerRegistration;

    // Then
    expect(jobQueue.scheduledQueues).toEqual(["quota-abandoned-refund.v1"]);
    expect(QUOTA_ABANDONED_REFUND_QUEUE.schedules).toEqual([
      {
        key: "quota-abandoned-refund-scheduler",
        cron: "*/10 * * * *",
        timezone: "UTC",
        missed: "skip",
        payload: {},
      },
    ]);
  });
});
