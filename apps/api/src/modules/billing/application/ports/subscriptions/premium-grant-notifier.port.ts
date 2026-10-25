import type { PremiumGrantEndingNotice } from "./premium-grant.repository.port.js";

export const PREMIUM_GRANT_NOTIFIER = Symbol("PREMIUM_GRANT_NOTIFIER");

export interface PremiumGrantNotifierPort {
  /** 지금 야간이라 참여 유도 알림을 미뤄야 하는 사용자 */
  findUsersInQuietHours(userIds: readonly string[], at: Date): Promise<ReadonlySet<string>>;
  /** 활성 UoW 안에서 알림함 기록과 푸시 outbox를 함께 남긴다. */
  notifyEndingSoon(notices: readonly PremiumGrantEndingNotice[]): Promise<void>;
}
