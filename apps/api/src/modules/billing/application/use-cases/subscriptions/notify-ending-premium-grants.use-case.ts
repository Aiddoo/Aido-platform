import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";

import { premiumGrantEndingNoticeUntil } from "../../../domain/policies/subscriptions/premium-access.policy.js";
import { BillingLogEvent } from "../../observability/subscriptions/billing-log.events.js";
import type { PremiumGrantNotifierPort } from "../../ports/subscriptions/premium-grant-notifier.port.js";
import type {
  PremiumGrantEndingNotice,
  PremiumGrantRepositoryPort,
} from "../../ports/subscriptions/premium-grant.repository.port.js";

export const PREMIUM_GRANT_ENDING_NOTICE = {
  BATCH_SIZE: 500,
  // 야간이라 미룬 후보가 앞자리를 채워도 뒤의 다른 시간대 사용자까지 보도록 한 실행에서 여러 묶음을
  // keyset으로 넘긴다. job 만료 안에 끝나도록 상한을 두고 남은 후보는 다음 실행이 다시 고른다
  MAX_BATCHES_PER_RUN: 20,
} as const;

export interface NotifyEndingPremiumGrantsInput {
  readonly now: Date;
}

export interface NotifyEndingPremiumGrantsResult {
  readonly notifiedCount: number;
  readonly deferredCount: number;
  readonly hasRemaining: boolean;
}

interface NotifyEndingPremiumGrantsDependencies {
  readonly premiumGrantRepository: Pick<
    PremiumGrantRepositoryPort,
    "lockEndingNotices" | "markEndingNotified"
  >;
  readonly notifier: PremiumGrantNotifierPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLogger;
}

/**
 * 보상 기간만으로 프리미엄인 사용자에게 끝나기 24시간 전에 한 번 알린다.
 * 야간 사용자는 표시하지 않고 남겨 다음 허용 시각의 실행이 보낸다. 마케팅 수신 동의가 없어 발송 단계가
 * 거르는 사용자는 표시해 두어 매 실행 다시 고르지 않는다.
 */
export class NotifyEndingPremiumGrants {
  readonly #dependencies: NotifyEndingPremiumGrantsDependencies;

  constructor(dependencies: NotifyEndingPremiumGrantsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: NotifyEndingPremiumGrantsInput): Promise<NotifyEndingPremiumGrantsResult> {
    let after: PremiumGrantEndingNotice | undefined;
    let notifiedCount = 0;
    let deferredCount = 0;
    let hasRemaining = false;

    for (let batch = 0; batch < PREMIUM_GRANT_ENDING_NOTICE.MAX_BATCHES_PER_RUN; batch++) {
      const result = await this.#notifyBatch(input.now, after);
      notifiedCount += result.notifiedCount;
      deferredCount += result.deferredCount;
      hasRemaining = result.candidateCount === PREMIUM_GRANT_ENDING_NOTICE.BATCH_SIZE;
      if (!hasRemaining) break;
      after = result.last;
    }

    this.#dependencies.logger.log({
      event: BillingLogEvent.PREMIUM_GRANT_ENDING_NOTIFIED,
      notifiedCount,
      deferredCount,
      hasRemaining,
    });
    return { notifiedCount, deferredCount, hasRemaining };
  }

  // 묶음마다 잠금·표시·알림 기록을 한 트랜잭션에 두어 재실행해도 같은 기간을 두 번 알리지 않는다
  async #notifyBatch(now: Date, after: PremiumGrantEndingNotice | undefined) {
    return this.#dependencies.unitOfWork.run(async () => {
      const candidates = await this.#dependencies.premiumGrantRepository.lockEndingNotices({
        now,
        endsBefore: premiumGrantEndingNoticeUntil(now),
        ...(after !== undefined && { after: { endsAt: after.endsAt, grantId: after.grantId } }),
        limit: PREMIUM_GRANT_ENDING_NOTICE.BATCH_SIZE,
      });
      const quietUserIds = await this.#dependencies.notifier.findUsersInQuietHours(
        candidates.map((notice) => notice.userId),
        now,
      );
      const notices = candidates.filter((notice) => !quietUserIds.has(notice.userId));

      await this.#dependencies.premiumGrantRepository.markEndingNotified(
        notices.map((notice) => notice.grantId),
        now,
      );
      await this.#dependencies.notifier.notifyEndingSoon(notices);
      return {
        candidateCount: candidates.length,
        notifiedCount: notices.length,
        deferredCount: candidates.length - notices.length,
        last: candidates.at(-1),
      };
    });
  }
}
