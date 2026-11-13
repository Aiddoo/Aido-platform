import { PREMIUM_GRANT_ENDING_NOTICE_DAYS } from "@aido/api/vocabulary";

import type {
  BillingNoticeSettings,
  BillingNoticeSweepInput,
  BillingNoticeSweepResult,
  SweepBillingNoticesUseCase,
} from "../../../shared/application/use-cases/sweep-billing-notices.use-case.js";
import type {
  PremiumGrantEndingNotice,
  PremiumGrantEndingNoticeRepositoryPort,
} from "../ports/premium-grant-ending-notice.repository.port.js";
import type { PremiumGrantNotifierPort } from "../ports/premium-grant-notifier.port.js";
import { PremiumGrantLogEvent } from "../premium-grants.log-events.js";

const PREMIUM_GRANT_ENDING_NOTICE = {
  noticeDays: PREMIUM_GRANT_ENDING_NOTICE_DAYS,
  // 보상은 받은 날 시작하므로 하루짜리 보상도 끝나기 전에 알린다
  isNoticeable: () => true,
  logEvent: PremiumGrantLogEvent.PREMIUM_GRANT_ENDING_NOTIFIED,
} as const satisfies BillingNoticeSettings<PremiumGrantEndingNotice>;

export interface NotifyEndingPremiumGrantsDependencies {
  readonly sweepBillingNotices: Pick<SweepBillingNoticesUseCase, "execute">;
  readonly noticeRepository: Pick<PremiumGrantEndingNoticeRepositoryPort, "listDue" | "claim">;
  readonly notifier: PremiumGrantNotifierPort;
}

/**
 * 보상 기간만으로 프리미엄인 사용자에게 끝나기 24시간 전에 한 번 알린다. 뒤에 스토어 구독이나 다른 보상이
 * 이어지면 고르지 않는다. 거래 알림이라 광고성 동의는 보지 않고, 푸시 설정이 꺼져 발송 단계가 거르는
 * 사용자도 표시해 두어 매 실행 다시 고르지 않는다.
 */
export class NotifyEndingPremiumGrantsUseCase {
  readonly #dependencies: NotifyEndingPremiumGrantsDependencies;

  constructor(dependencies: NotifyEndingPremiumGrantsDependencies) {
    this.#dependencies = dependencies;
  }

  execute(command: BillingNoticeSweepInput): Promise<BillingNoticeSweepResult> {
    const { sweepBillingNotices, noticeRepository, notifier } = this.#dependencies;
    return sweepBillingNotices.execute({
      task: { ...PREMIUM_GRANT_ENDING_NOTICE, source: noticeRepository, notifier },
      now: command.now,
    });
  }
}
