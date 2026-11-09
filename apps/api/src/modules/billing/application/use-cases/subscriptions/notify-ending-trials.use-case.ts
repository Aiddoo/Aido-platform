import { PREMIUM_TRIAL_ENDING_NOTICE_DAYS } from "@aido/api/vocabulary";

import { BillingNoticeWindowPolicy } from "../../../domain/policies/subscriptions/billing-notice-window.policy.js";
import { BillingLogEvent } from "../../observability/subscriptions/billing-log.events.js";
import type {
  TrialEndingNotice,
  TrialEndingNoticeSourcePort,
} from "../../ports/subscriptions/trial-ending-notice.source.port.js";
import type { TrialEndingNotifierPort } from "../../ports/subscriptions/trial-ending-notifier.port.js";
import type {
  BillingNoticeSettings,
  BillingNoticeSweepInput,
  BillingNoticeSweepResult,
  BillingNoticeSweeper,
} from "../../services/subscriptions/billing-notice-sweeper.js";

export const TRIAL_ENDING_NOTICE = {
  noticeDays: PREMIUM_TRIAL_ENDING_NOTICE_DAYS,
  isNoticeable: (notice) =>
    BillingNoticeWindowPolicy.isNoticeable(
      notice.startedAt,
      notice.expiresAt,
      PREMIUM_TRIAL_ENDING_NOTICE_DAYS,
    ),
  logEvent: BillingLogEvent.TRIAL_ENDING_NOTIFIED,
} as const satisfies BillingNoticeSettings<TrialEndingNotice>;

interface NotifyEndingTrialsDependencies {
  readonly sweeper: Pick<BillingNoticeSweeper, "sweep">;
  readonly source: TrialEndingNoticeSourcePort;
  readonly notifier: TrialEndingNotifierPort;
}

/**
 * 무료 체험이 끝나기 3일 안에 한 번 알린다. 시작할 때 이미 3일 이하로 남은 체험은 보내지 않는다.
 * 결제 예정·체험 종료는 거래 정보라 광고성 동의 없이 보낸다.
 */
export class NotifyEndingTrials {
  readonly #dependencies: NotifyEndingTrialsDependencies;

  constructor(dependencies: NotifyEndingTrialsDependencies) {
    this.#dependencies = dependencies;
  }

  execute(input: BillingNoticeSweepInput): Promise<BillingNoticeSweepResult> {
    const { sweeper, source, notifier } = this.#dependencies;
    return sweeper.sweep({ ...TRIAL_ENDING_NOTICE, source, notifier }, input);
  }
}
