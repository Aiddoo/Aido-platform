import { chunk } from "es-toolkit";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";

import { TrialEndingNoticePolicy } from "../../../domain/policies/subscriptions/trial-ending-notice.policy.js";
import { BillingLogEvent } from "../../observability/subscriptions/billing-log.events.js";
import type {
  SubscriptionRepositoryPort,
  TrialEndingNotice,
} from "../../ports/subscriptions/subscription.repository.port.js";
import type { TrialEndingNotifierPort } from "../../ports/subscriptions/trial-ending-notifier.port.js";

export const TRIAL_ENDING_NOTICE = {
  /** 한 번에 읽는 후보 수 */
  BATCH_SIZE: 500,
  /** 한 트랜잭션에서 표시·알림 기록을 남기는 수. 알림 outbox 쓰기를 짧게 나눈다 */
  CLAIM_CHUNK_SIZE: 100,
  // 야간이라 미룬 후보가 앞자리를 채워도 뒤 시간대 사용자까지 보도록 keyset으로 넘기고, job 만료 안에 끝나게 상한을 둔다
  MAX_BATCHES_PER_RUN: 20,
} as const;

export interface NotifyEndingTrialsInput {
  readonly now: Date;
}

export interface NotifyEndingTrialsResult {
  readonly notifiedCount: number;
  readonly deferredCount: number;
  readonly skippedCount: number;
  readonly hasRemaining: boolean;
}

interface NotifyEndingTrialsDependencies {
  readonly subscriptionRepository: Pick<
    SubscriptionRepositoryPort,
    "findTrialEndingNotices" | "claimTrialEndingNotices"
  >;
  readonly notifier: TrialEndingNotifierPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: Pick<ApplicationLogger, "log">;
}

/**
 * 무료 체험이 끝나기 3일 안에 한 번 알린다. 현지 야간인 사용자는 표시하지 않고 다음 허용 시각의 실행이
 * 보낸다. 시작할 때 이미 3일 이하로 남은 체험은 보내지 않는다. 표시는 조건부 UPDATE라 두 실행이 겹쳐도
 * 한 실행만 그 체험을 알린다.
 */
export class NotifyEndingTrials {
  readonly #dependencies: NotifyEndingTrialsDependencies;

  constructor(dependencies: NotifyEndingTrialsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: NotifyEndingTrialsInput): Promise<NotifyEndingTrialsResult> {
    let after: TrialEndingNotice | undefined;
    let notifiedCount = 0;
    let deferredCount = 0;
    let skippedCount = 0;
    let hasRemaining = false;

    for (let batch = 0; batch < TRIAL_ENDING_NOTICE.MAX_BATCHES_PER_RUN; batch++) {
      const candidates = await this.#dependencies.subscriptionRepository.findTrialEndingNotices({
        now: input.now,
        endsBefore: TrialEndingNoticePolicy.noticeUntil(input.now),
        ...(after != null && {
          after: { expiresAt: after.expiresAt, subscriptionId: after.subscriptionId },
        }),
        limit: TRIAL_ENDING_NOTICE.BATCH_SIZE,
      });
      const noticeable = candidates.filter((notice) =>
        TrialEndingNoticePolicy.isNoticeable(notice),
      );
      const quietUserIds = await this.#dependencies.notifier.findUsersInQuietHours(
        noticeable.map((notice) => notice.userId),
        input.now,
      );
      const due = noticeable.filter((notice) => !quietUserIds.has(notice.userId));

      for (const notices of chunk(due, TRIAL_ENDING_NOTICE.CLAIM_CHUNK_SIZE)) {
        notifiedCount += await this.#claimAndNotify(notices, input.now);
      }
      deferredCount += noticeable.length - due.length;
      skippedCount += candidates.length - noticeable.length;

      hasRemaining = candidates.length === TRIAL_ENDING_NOTICE.BATCH_SIZE;
      if (!hasRemaining) {
        break;
      }
      after = candidates.at(-1);
    }

    this.#dependencies.logger.log({
      event: BillingLogEvent.TRIAL_ENDING_NOTIFIED,
      notifiedCount,
      deferredCount,
      skippedCount,
      hasRemaining,
    });
    return { notifiedCount, deferredCount, skippedCount, hasRemaining };
  }

  // 표시와 알림 기록을 한 트랜잭션에 두어 실패하면 함께 되돌리고 다음 실행이 다시 보낸다
  async #claimAndNotify(notices: readonly TrialEndingNotice[], now: Date): Promise<number> {
    return this.#dependencies.unitOfWork.run(async () => {
      const claimedIds = new Set(
        await this.#dependencies.subscriptionRepository.claimTrialEndingNotices(
          notices.map((notice) => notice.subscriptionId),
          now,
        ),
      );
      const claimed = notices.filter((notice) => claimedIds.has(notice.subscriptionId));
      await this.#dependencies.notifier.notifyTrialEnding(claimed, now);
      return claimed.length;
    });
  }
}
