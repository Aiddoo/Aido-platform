import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { SUBSCRIPTION_FIXTURE_NOW } from "#test/fixtures/billing/subscription.fixture";

import {
  type BillingNotice,
  BillingNoticeNotifierPort,
  BillingNoticeRepositoryPort,
  type FindDueBillingNoticesParams,
} from "../ports/billing-notice.port.js";
import { QuietHoursReaderPort } from "../ports/quiet-hours.reader.port.js";
import {
  BILLING_NOTICE_SWEEP,
  SweepBillingNoticesUseCase,
} from "./sweep-billing-notices.use-case.js";

const NOW = SUBSCRIPTION_FIXTURE_NOW;

interface TestNotice extends BillingNotice {
  readonly id: number;
}

class InMemoryNoticeRepository extends BillingNoticeRepositoryPort<TestNotice> {
  readonly claimed = new Set<number>();
  readonly listCalls: FindDueBillingNoticesParams<TestNotice>[] = [];

  readonly notices: readonly TestNotice[];

  constructor(notices: readonly TestNotice[]) {
    super();
    this.notices = notices;
  }

  async listDue(params: FindDueBillingNoticesParams<TestNotice>): Promise<TestNotice[]> {
    this.listCalls.push(params);
    const afterId = params.after?.id ?? 0;
    return this.notices
      .filter((notice) => notice.id > afterId && !this.claimed.has(notice.id))
      .slice(0, params.limit);
  }

  async claim(notices: readonly TestNotice[]): Promise<TestNotice[]> {
    const fresh = notices.filter((notice) => !this.claimed.has(notice.id));
    for (const notice of fresh) {
      this.claimed.add(notice.id);
    }
    return fresh;
  }
}

class RecordingNotifier extends BillingNoticeNotifierPort<TestNotice> {
  readonly notified: number[] = [];

  async notify(notices: readonly TestNotice[]): Promise<void> {
    this.notified.push(...notices.map((notice) => notice.id));
  }
}

class StubQuietHoursReader extends QuietHoursReaderPort {
  readonly quiet: ReadonlySet<string>;

  constructor(quiet: ReadonlySet<string> = new Set()) {
    super();
    this.quiet = quiet;
  }

  async findUsersInQuietHours(): Promise<ReadonlySet<string>> {
    return this.quiet;
  }
}

function setup(quiet: ReadonlySet<string> = new Set()) {
  const logger = new SilentLogger();
  const useCase = new SweepBillingNoticesUseCase({
    quietHoursReader: new StubQuietHoursReader(quiet),
    unitOfWork: new ImmediateUnitOfWork(),
    logger,
  });
  return { useCase, logger };
}

function noticesOf(count: number): TestNotice[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    userId: `user-${index + 1}`,
  }));
}

describe("SweepBillingNoticesUseCase — 결제·보상 안내 sweep", () => {
  it("대상 안내를 표시하고 보내며 결과를 요약 로그 한 건으로 남긴다", async () => {
    // Given
    const { useCase, logger } = setup();
    const source = new InMemoryNoticeRepository(noticesOf(3));
    const notifier = new RecordingNotifier();

    // When
    const result = await useCase.execute({
      task: {
        noticeDays: 3,
        isNoticeable: () => true,
        logEvent: "test.notified",
        source,
        notifier,
      },
      now: NOW,
    });

    // Then
    expect(result).toEqual({
      notifiedCount: 3,
      deferredCount: 0,
      skippedCount: 0,
      hasRemaining: false,
    });
    expect(notifier.notified).toEqual([1, 2, 3]);
    expect(logger.messages).toEqual([{ event: "test.notified", ...result }]);
  });

  it("현지 야간인 사용자는 표시하지 않고 미룬다", async () => {
    // Given
    const { useCase } = setup(new Set(["user-2"]));
    const source = new InMemoryNoticeRepository(noticesOf(3));
    const notifier = new RecordingNotifier();

    // When
    const result = await useCase.execute({
      task: { noticeDays: 3, isNoticeable: () => true, logEvent: "test", source, notifier },
      now: NOW,
    });

    // Then
    expect(result).toMatchObject({ notifiedCount: 2, deferredCount: 1 });
    expect(source.claimed.has(2)).toBe(false);
  });

  it("보낼 수 없는 후보는 표시하지 않고 건너뛴 수로 센다", async () => {
    // Given
    const { useCase } = setup();
    const source = new InMemoryNoticeRepository(noticesOf(3));
    const notifier = new RecordingNotifier();

    // When
    const result = await useCase.execute({
      task: { noticeDays: 3, isNoticeable: (n) => n.id !== 1, logEvent: "test", source, notifier },
      now: NOW,
    });

    // Then
    expect(result).toMatchObject({ notifiedCount: 2, skippedCount: 1 });
  });

  it("이미 다른 실행이 표시한 안내는 보내지 않는다", async () => {
    // Given
    const { useCase } = setup();
    const source = new InMemoryNoticeRepository(noticesOf(2));
    source.claimed.add(1);
    const notifier = new RecordingNotifier();

    // When
    await useCase.execute({
      task: { noticeDays: 3, isNoticeable: () => true, logEvent: "test", source, notifier },
      now: NOW,
    });
    await useCase.execute({
      task: { noticeDays: 3, isNoticeable: () => true, logEvent: "test", source, notifier },
      now: NOW,
    });

    // Then
    expect(notifier.notified).toEqual([2]);
  });

  it("후보가 한 묶음을 가득 채우면 마지막 후보 다음부터 keyset으로 이어 읽는다", async () => {
    // Given
    const { useCase } = setup();
    const source = new InMemoryNoticeRepository(noticesOf(BILLING_NOTICE_SWEEP.BATCH_SIZE + 1));
    const notifier = new RecordingNotifier();

    // When
    const result = await useCase.execute({
      task: { noticeDays: 3, isNoticeable: () => true, logEvent: "test", source, notifier },
      now: NOW,
    });

    // Then
    expect(result.notifiedCount).toBe(BILLING_NOTICE_SWEEP.BATCH_SIZE + 1);
    expect(source.listCalls[1]?.after?.id).toBe(BILLING_NOTICE_SWEEP.BATCH_SIZE);
  });

  it("안내 기간 끝은 지금에서 안내 일수(24시간 단위) 뒤다", async () => {
    // Given
    const { useCase } = setup();
    const source = new InMemoryNoticeRepository([]);

    // When
    await useCase.execute({
      task: {
        noticeDays: 3,
        isNoticeable: () => true,
        logEvent: "test",
        source,
        notifier: new RecordingNotifier(),
      },
      now: NOW,
    });

    // Then
    expect(source.listCalls[0]).toMatchObject({
      now: NOW,
      endsBefore: NOW.add({ hours: 72 }),
      limit: BILLING_NOTICE_SWEEP.BATCH_SIZE,
    });
  });
});
