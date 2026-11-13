import { chunk, sumBy } from "es-toolkit";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { billingNoticeUntil } from "../../domain/billing-notice-window.domain-service.js";
import type { BillingNoticeNotifierPort } from "../ports/billing-notice-notifier.port.js";
import type {
  BillingNotice,
  BillingNoticeRepositoryPort,
} from "../ports/billing-notice.repository.port.js";
import type { QuietHoursReaderPort } from "../ports/quiet-hours.reader.port.js";

export const BILLING_NOTICE_SWEEP = {
  /** 한 번에 읽는 후보 수 */
  BATCH_SIZE: 500,
  /** 한 트랜잭션에서 표시·알림 기록을 남기는 수. 알림 outbox 쓰기를 짧게 나눈다 */
  CLAIM_CHUNK_SIZE: 100,
  // 야간이라 미룬 후보가 앞자리를 채워도 뒤 시간대 사용자까지 보도록 keyset으로 넘기고, job 만료 안에 끝나게 상한을 둔다
  MAX_BATCHES_PER_RUN: 20,
} as const;

/** 무엇을 언제 안내할지. 안내 UseCase 파일이 상수로 갖는다. */
export interface BillingNoticeSettings<TNotice extends BillingNotice> {
  /** 끝나기 이 일수 전부터 안내한다. */
  readonly noticeDays: number;
  /** 고른 후보 중 보낼 것 */
  readonly isNoticeable: (notice: TNotice) => boolean;
  /** sweep 한 번에 남기는 요약 로그 이벤트 */
  readonly logEvent: string;
}

/** sweep 한 번의 대상. 설정과 그 안내의 저장소·발송을 함께 넘긴다. */
export interface BillingNoticeTask<
  TNotice extends BillingNotice,
> extends BillingNoticeSettings<TNotice> {
  readonly source: Pick<BillingNoticeRepositoryPort<TNotice>, "listDue" | "claim">;
  readonly notifier: Pick<BillingNoticeNotifierPort<TNotice>, "notify">;
}

export interface SweepBillingNoticesCommand<TNotice extends BillingNotice> {
  readonly task: BillingNoticeTask<TNotice>;
  readonly now: Temporal.Instant;
}

export interface BillingNoticeSweepInput {
  readonly now: Temporal.Instant;
}

export interface BillingNoticeSweepResult {
  readonly notifiedCount: number;
  readonly deferredCount: number;
  readonly skippedCount: number;
  readonly hasRemaining: boolean;
}

interface BillingNoticeBatchResult {
  readonly notifiedCount: number;
  readonly deferredCount: number;
  readonly skippedCount: number;
  /** 한 묶음을 가득 채워 뒤에 후보가 더 있을 수 있다. */
  readonly isFull: boolean;
}

export interface SweepBillingNoticesDependencies {
  readonly quietHoursReader: QuietHoursReaderPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/**
 * 며칠 전 결제·보상 안내를 한 실행에서 묶음으로 보낸다. 후보는 트랜잭션 밖에서 읽고, 현지 야간인 사용자는
 * 표시하지 않아 다음 허용 시각의 실행이 보낸다. 표시는 조건부 UPDATE라 두 실행이 겹쳐도 한 실행만 보낸다.
 */
export class SweepBillingNoticesUseCase {
  readonly #dependencies: SweepBillingNoticesDependencies;

  constructor(dependencies: SweepBillingNoticesDependencies) {
    this.#dependencies = dependencies;
  }

  async execute<TNotice extends BillingNotice>(
    command: SweepBillingNoticesCommand<TNotice>,
  ): Promise<BillingNoticeSweepResult> {
    const { task, now } = command;
    const batches: BillingNoticeBatchResult[] = [];
    for await (const candidates of this.#listDueBatches(task, now)) {
      batches.push(await this.#sendBatch(task, candidates, now));
    }
    const result = {
      notifiedCount: sumBy(batches, (batch) => batch.notifiedCount),
      deferredCount: sumBy(batches, (batch) => batch.deferredCount),
      skippedCount: sumBy(batches, (batch) => batch.skippedCount),
      hasRemaining: batches.at(-1)?.isFull ?? false,
    };
    this.#dependencies.logger.log({ event: task.logEvent, ...result });
    return result;
  }

  async *#listDueBatches<TNotice extends BillingNotice>(
    task: BillingNoticeTask<TNotice>,
    now: Temporal.Instant,
  ): AsyncGenerator<TNotice[]> {
    const endsBefore = billingNoticeUntil(now, task.noticeDays);
    let after: TNotice | undefined;
    for (let batch = 0; batch < BILLING_NOTICE_SWEEP.MAX_BATCHES_PER_RUN; batch++) {
      const candidates = await task.source.listDue({
        now,
        endsBefore,
        ...(after != null && { after }),
        limit: BILLING_NOTICE_SWEEP.BATCH_SIZE,
      });
      yield candidates;
      if (candidates.length < BILLING_NOTICE_SWEEP.BATCH_SIZE) {
        return;
      }
      after = candidates.at(-1);
    }
  }

  async #sendBatch<TNotice extends BillingNotice>(
    task: BillingNoticeTask<TNotice>,
    candidates: readonly TNotice[],
    now: Temporal.Instant,
  ): Promise<BillingNoticeBatchResult> {
    const noticeable = candidates.filter(task.isNoticeable);
    const quietUserIds = await this.#dependencies.quietHoursReader.findUsersInQuietHours(
      noticeable.map((notice) => notice.userId),
      now,
    );
    const due = noticeable.filter((notice) => !quietUserIds.has(notice.userId));
    const notifiedCounts: number[] = [];
    for (const notices of chunk(due, BILLING_NOTICE_SWEEP.CLAIM_CHUNK_SIZE)) {
      notifiedCounts.push(await this.#claimAndNotify(task, notices, now));
    }
    return {
      notifiedCount: sumBy(notifiedCounts, (count) => count),
      deferredCount: noticeable.length - due.length,
      skippedCount: candidates.length - noticeable.length,
      isFull: candidates.length === BILLING_NOTICE_SWEEP.BATCH_SIZE,
    };
  }

  // 표시와 알림 기록을 한 트랜잭션에 두어 실패하면 함께 되돌리고 다음 실행이 다시 보낸다
  async #claimAndNotify<TNotice extends BillingNotice>(
    task: BillingNoticeTask<TNotice>,
    notices: readonly TNotice[],
    now: Temporal.Instant,
  ): Promise<number> {
    return this.#dependencies.unitOfWork.run(async () => {
      const claimed = await task.source.claim(notices, now);
      await task.notifier.notify(claimed, now);
      return claimed.length;
    });
  }
}
