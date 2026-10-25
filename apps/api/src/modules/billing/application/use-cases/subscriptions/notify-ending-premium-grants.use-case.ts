import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";

import { premiumGrantEndingNoticeUntil } from "../../../domain/policies/subscriptions/premium-access.policy.js";
import { BillingLogEvent } from "../../observability/subscriptions/billing-log.events.js";
import type { PremiumGrantNotifierPort } from "../../ports/subscriptions/premium-grant-notifier.port.js";
import type { PremiumGrantRepositoryPort } from "../../ports/subscriptions/premium-grant.repository.port.js";

export const PREMIUM_GRANT_ENDING_NOTICE_BATCH_SIZE = 500;

export interface NotifyEndingPremiumGrantsInput {
  readonly now: Date;
}

export interface NotifyEndingPremiumGrantsResult {
  readonly notifiedCount: number;
  readonly deferredCount: number;
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
 * 야간 사용자는 표시하지 않고 남겨 다음 허용 시각의 실행이 보낸다.
 */
export class NotifyEndingPremiumGrants {
  readonly #dependencies: NotifyEndingPremiumGrantsDependencies;

  constructor(dependencies: NotifyEndingPremiumGrantsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: NotifyEndingPremiumGrantsInput): Promise<NotifyEndingPremiumGrantsResult> {
    const result = await this.#dependencies.unitOfWork.run(async () => {
      const candidates = await this.#dependencies.premiumGrantRepository.lockEndingNotices({
        now: input.now,
        endsBefore: premiumGrantEndingNoticeUntil(input.now),
        limit: PREMIUM_GRANT_ENDING_NOTICE_BATCH_SIZE,
      });
      const quietUserIds = await this.#dependencies.notifier.findUsersInQuietHours(
        candidates.map((notice) => notice.userId),
        input.now,
      );
      const notices = candidates.filter((notice) => !quietUserIds.has(notice.userId));

      // 표시와 알림 기록을 한 트랜잭션에 두어 재실행해도 같은 기간을 두 번 알리지 않는다
      await this.#dependencies.premiumGrantRepository.markEndingNotified(
        notices.map((notice) => notice.grantId),
        input.now,
      );
      await this.#dependencies.notifier.notifyEndingSoon(notices);
      return { notifiedCount: notices.length, deferredCount: candidates.length - notices.length };
    });

    this.#dependencies.logger.log({
      event: BillingLogEvent.PREMIUM_GRANT_ENDING_NOTIFIED,
      ...result,
    });
    return result;
  }
}
