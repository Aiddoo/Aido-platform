import type { TrialEndingNotice } from "./subscription.repository.port.js";

export const TRIAL_ENDING_NOTIFIER = Symbol("TRIAL_ENDING_NOTIFIER");

export interface TrialEndingNotifierPort {
  /** 지금 받는 사람 현지 야간(21:00–08:00)이라 다음 허용 시각으로 미룰 사용자 */
  findUsersInQuietHours(userIds: readonly string[], at: Date): Promise<ReadonlySet<string>>;
  /** 활성 UoW 안에서 알림함 기록과 푸시 outbox를 함께 남긴다. */
  notifyTrialEnding(notices: readonly TrialEndingNotice[], now: Date): Promise<void>;
}
