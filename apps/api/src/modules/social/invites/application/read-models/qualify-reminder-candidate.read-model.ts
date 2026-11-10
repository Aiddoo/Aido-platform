/** 사용 시작 알림 후보. 활동일 수는 같은 문장에서 센다. */
export interface QualifyReminderCandidate {
  readonly redemptionId: string;
  /** 수락할 때 고정한 초대받은 사람 시간대 */
  readonly timezone: string;
  readonly expiresAt: Temporal.Instant;
  readonly activeDayCount: number;
}
