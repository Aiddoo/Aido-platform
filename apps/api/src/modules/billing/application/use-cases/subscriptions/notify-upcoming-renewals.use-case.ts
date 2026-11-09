import { PREMIUM_RENEWAL_NOTICE_DAYS } from "@aido/api/vocabulary";

import { BillingLogEvent } from "../../observability/subscriptions/billing-log.events.js";
import type {
  UpcomingRenewalNotice,
  UpcomingRenewalNoticeSourcePort,
} from "../../ports/subscriptions/upcoming-renewal-notice.source.port.js";
import type { UpcomingRenewalNotifierPort } from "../../ports/subscriptions/upcoming-renewal-notifier.port.js";
import type {
  BillingNoticeSettings,
  BillingNoticeSweepInput,
  BillingNoticeSweepResult,
  BillingNoticeSweeper,
} from "../../services/subscriptions/billing-notice-sweeper.js";

export const UPCOMING_RENEWAL_NOTICE = {
  noticeDays: PREMIUM_RENEWAL_NOTICE_DAYS,
  // 연간 기간은 안내 기간(7일)보다 길어 기간 시작 직후 알림이 되는 경우가 없다
  isNoticeable: () => true,
  logEvent: BillingLogEvent.RENEWAL_UPCOMING_NOTIFIED,
} as const satisfies BillingNoticeSettings<UpcomingRenewalNotice>;

interface NotifyUpcomingRenewalsDependencies {
  readonly sweeper: Pick<BillingNoticeSweeper, "sweep">;
  readonly source: UpcomingRenewalNoticeSourcePort;
  readonly notifier: UpcomingRenewalNotifierPort;
}

/**
 * 연간으로 자동 갱신될 구독에 결제 7일 전 기간마다 한 번 알린다. 월간은 매달 알리면 피로해서 보내지 않는다.
 * 결제 예정은 거래 정보라 광고성 동의 없이 보낸다.
 */
export class NotifyUpcomingRenewals {
  readonly #dependencies: NotifyUpcomingRenewalsDependencies;

  constructor(dependencies: NotifyUpcomingRenewalsDependencies) {
    this.#dependencies = dependencies;
  }

  execute(input: BillingNoticeSweepInput): Promise<BillingNoticeSweepResult> {
    const { sweeper, source, notifier } = this.#dependencies;
    return sweeper.sweep({ ...UPCOMING_RENEWAL_NOTICE, source, notifier }, input);
  }
}
