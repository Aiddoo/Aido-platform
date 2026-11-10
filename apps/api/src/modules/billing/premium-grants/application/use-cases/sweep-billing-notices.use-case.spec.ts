import { createUnitOfWorkMock } from "#test/mocks/ports/unit-of-work.mock";

import type {
  BillingNoticeSourcePort,
  FindDueBillingNoticesParams,
} from "../ports/billing-notice.port.js";
import {
  BILLING_NOTICE_SWEEP,
  SweepBillingNoticesUseCase,
} from "./sweep-billing-notices.use-case.js";

const NOW = new Date("2028-02-26T13:00:00.000Z");

interface TestNotice {
  readonly id: number;
  readonly userId: string;
  readonly endsAt: Date;
}

function notice(id: number, userId = `user-${id}`): TestNotice {
  return { id, userId, endsAt: new Date(NOW.getTime() + 60_000 + id) };
}

/** 표시하지 않은 후보만 (endsAt, id) 순으로 다시 고르는 저장소 대역. 조건부 UPDATE·keyset SQL은 실제 PG에서 본다. */
class StubNoticeSource implements BillingNoticeSourcePort<TestNotice> {
  readonly claimedIds = new Set<number>();
  readonly requests: FindDueBillingNoticesParams<TestNotice>[] = [];

  readonly #candidates: readonly TestNotice[];

  constructor(candidates: readonly TestNotice[]) {
    this.#candidates = candidates;
  }

  async findDue(params: FindDueBillingNoticesParams<TestNotice>): Promise<TestNotice[]> {
    this.requests.push(params);
    const { after } = params;
    return this.#candidates
      .filter((candidate) => !this.claimedIds.has(candidate.id))
      .filter((candidate) => after == null || candidate.id > after.id)
      .slice(0, params.limit);
  }

  async claim(notices: readonly TestNotice[]): Promise<TestNotice[]> {
    const claimed = notices.filter((candidate) => !this.claimedIds.has(candidate.id));
    for (const candidate of claimed) {
      this.claimedIds.add(candidate.id);
    }
    return claimed;
  }
}

function createSweeper(candidates: readonly TestNotice[], quietUserIds = new Set<string>()) {
  const source = new StubNoticeSource(candidates);
  const sent: TestNotice[] = [];
  const sweeper = new SweepBillingNoticesUseCase({
    quietHoursReader: {
      findUsersInQuietHours: async (userIds) =>
        new Set(userIds.filter((userId) => quietUserIds.has(userId))),
    },
    unitOfWork: createUnitOfWorkMock(),
    logger: { log: () => {} },
  });
  const task = {
    source,
    notifier: {
      notify: async (notices: readonly TestNotice[]) => {
        sent.push(...notices);
      },
    },
    noticeDays: 1,
    isNoticeable: () => true,
    logEvent: "billing.premium-grant.ending.notified",
  } as const;
  const sweep = () => sweeper.sweep(task, { now: NOW });
  return { sweep, source, sent, quietUserIds };
}

describe("SweepBillingNoticesUseCase — 며칠 전 결제·보상 안내", () => {
  it("두 sweep이 같은 후보를 함께 읽어도 표시를 먼저 얻은 실행만 보낸다", async () => {
    // Given
    const { sweep, sent } = createSweeper([notice(1)]);

    // When
    const results = await Promise.all([sweep(), sweep()]);

    // Then
    expect(results.map((result) => result.notifiedCount).sort()).toEqual([0, 1]);
    expect(sent).toHaveLength(1);
  });

  it("현지 야간인 사용자는 표시하지 않고 미뤄 야간이 끝난 다음 실행이 한 번 보낸다", async () => {
    // Given
    const { sweep, sent, quietUserIds } = createSweeper(
      [notice(1, "seoul"), notice(2, "london")],
      new Set(["seoul"]),
    );

    // When
    const night = await sweep();
    quietUserIds.clear();
    const morning = await sweep();
    const later = await sweep();

    // Then
    expect(night).toMatchObject({ notifiedCount: 1, deferredCount: 1 });
    expect(morning).toMatchObject({ notifiedCount: 1, deferredCount: 0 });
    expect(later.notifiedCount).toBe(0);
    expect(sent.map((candidate) => candidate.userId)).toEqual(["london", "seoul"]);
  });

  it("앞 묶음이 모두 야간 사용자여도 같은 실행에서 다음 묶음의 다른 시간대 사용자에게 보낸다", async () => {
    // Given
    const night = Array.from({ length: BILLING_NOTICE_SWEEP.BATCH_SIZE }, (_, index) =>
      notice(index + 1, `seoul-${index}`),
    );
    const day = notice(BILLING_NOTICE_SWEEP.BATCH_SIZE + 1, "los-angeles");
    const { sweep, source, sent } = createSweeper(
      [...night, day],
      new Set(night.map((candidate) => candidate.userId)),
    );

    // When
    const result = await sweep();

    // Then
    expect(sent).toEqual([day]);
    expect(source.requests.map((request) => request.after?.id)).toEqual([
      undefined,
      BILLING_NOTICE_SWEEP.BATCH_SIZE,
    ]);
    expect(result).toEqual({
      notifiedCount: 1,
      deferredCount: BILLING_NOTICE_SWEEP.BATCH_SIZE,
      skippedCount: 0,
      hasRemaining: false,
    });
  });

  it("한 실행이 읽는 묶음 수에 상한을 두고 남은 후보가 있다고 알린다", async () => {
    // Given
    const total = BILLING_NOTICE_SWEEP.BATCH_SIZE * BILLING_NOTICE_SWEEP.MAX_BATCHES_PER_RUN;
    const candidates = Array.from({ length: total + 1 }, (_, index) => notice(index + 1));
    const { sweep, source } = createSweeper(
      candidates,
      new Set(candidates.map((candidate) => candidate.userId)),
    );

    // When
    const result = await sweep();

    // Then
    expect(source.requests).toHaveLength(BILLING_NOTICE_SWEEP.MAX_BATCHES_PER_RUN);
    expect(result).toMatchObject({ notifiedCount: 0, deferredCount: total, hasRemaining: true });
  });
});
