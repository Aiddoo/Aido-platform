import { PREMIUM_RENEWAL_NOTICE_DAYS } from "@aido/api/vocabulary";

import type {
  BillingNoticeSettings,
  BillingNoticeSweepInput,
  BillingNoticeSweepResult,
  SweepBillingNoticesUseCase,
} from "../../../shared/application/use-cases/sweep-billing-notices.use-case.js";
import type {
  UpcomingRenewalNotice,
  UpcomingRenewalNoticeRepositoryPort,
} from "../ports/upcoming-renewal-notice.repository.port.js";
import type { UpcomingRenewalNotifierPort } from "../ports/upcoming-renewal-notifier.port.js";
import { SubscriptionLogEvent } from "../subscriptions.log-events.js";

const UPCOMING_RENEWAL_NOTICE = {
  noticeDays: PREMIUM_RENEWAL_NOTICE_DAYS,
  // Play에서 요금제를 바꿔 원래 만료까지 남은 옛 체인은 다음 결제를 정하지 않는다
  isNoticeable: (notice) => notice.isCurrentChain,
  logEvent: SubscriptionLogEvent.RENEWAL_UPCOMING_NOTIFIED,
} as const satisfies BillingNoticeSettings<UpcomingRenewalNotice>;

export interface NotifyUpcomingRenewalsDependencies {
  readonly sweepBillingNotices: Pick<SweepBillingNoticesUseCase, "execute">;
  readonly noticeRepository: Pick<UpcomingRenewalNoticeRepositoryPort, "listDue" | "claim">;
  readonly notifier: UpcomingRenewalNotifierPort;
}

/**
 * 연간으로 자동 갱신될 구독에 결제 7일 전 기간마다 한 번 알린다. 월간은 매달 알리면 피로해서 보내지 않는다.
 * 결제 예정은 거래 정보라 광고성 동의 없이 보낸다.
 */
export class NotifyUpcomingRenewalsUseCase {
  readonly #dependencies: NotifyUpcomingRenewalsDependencies;

  constructor(dependencies: NotifyUpcomingRenewalsDependencies) {
    this.#dependencies = dependencies;
  }

  execute(command: BillingNoticeSweepInput): Promise<BillingNoticeSweepResult> {
    const { sweepBillingNotices, noticeRepository, notifier } = this.#dependencies;
    return sweepBillingNotices.execute({
      task: { ...UPCOMING_RENEWAL_NOTICE, source: noticeRepository, notifier },
      now: command.now,
    });
  }
}
