import { PREMIUM_TRIAL_ENDING_NOTICE_DAYS } from "@aido/api/vocabulary";

import type {
  BillingNoticeSettings,
  BillingNoticeSweepInput,
  BillingNoticeSweepResult,
  SweepBillingNoticesUseCase,
} from "../../../shared/application/use-cases/sweep-billing-notices.use-case.js";
import type { TrialEndingNoticeRepositoryPort } from "../ports/trial-ending-notice.repository.port.js";
import type { TrialEndingNotifierPort } from "../ports/trial-ending-notifier.port.js";
import { SubscriptionLogEvent } from "../subscriptions.log-events.js";

const TRIAL_ENDING_NOTICE = {
  noticeDays: PREMIUM_TRIAL_ENDING_NOTICE_DAYS,
  logEvent: SubscriptionLogEvent.TRIAL_ENDING_NOTIFIED,
} as const satisfies BillingNoticeSettings;

export interface NotifyEndingTrialsDependencies {
  readonly sweepBillingNotices: Pick<SweepBillingNoticesUseCase, "execute">;
  readonly noticeRepository: Pick<TrialEndingNoticeRepositoryPort, "listDue" | "claim">;
  readonly notifier: TrialEndingNotifierPort;
}

/**
 * 무료 체험이 끝나기 3일 안에 한 번 알린다. 시작할 때 이미 3일 이하로 남은 체험은 보내지 않는다.
 * 결제 예정·체험 종료는 거래 정보라 광고성 동의 없이 보낸다.
 */
export class NotifyEndingTrialsUseCase {
  readonly #dependencies: NotifyEndingTrialsDependencies;

  constructor(dependencies: NotifyEndingTrialsDependencies) {
    this.#dependencies = dependencies;
  }

  execute(command: BillingNoticeSweepInput): Promise<BillingNoticeSweepResult> {
    const { sweepBillingNotices, noticeRepository, notifier } = this.#dependencies;
    return sweepBillingNotices.execute({
      task: { ...TRIAL_ENDING_NOTICE, source: noticeRepository, notifier },
      now: command.now,
    });
  }
}
