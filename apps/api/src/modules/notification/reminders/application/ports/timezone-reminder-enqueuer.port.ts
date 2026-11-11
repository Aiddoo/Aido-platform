/** 사용자가 아침·저녁 리마인더 시간을 바꿨을 때. 바꾼 시각이 지금이면 바로 보낸다 */
export interface ReminderHourChangedJobData {
  readonly userId: string;
  readonly timezone: string;
  /** 바꾸지 않은 값은 비어 있다 */
  readonly morningReminderHour?: number;
  readonly morningReminderMinute?: number;
  readonly eveningReminderHour?: number;
  readonly eveningReminderMinute?: number;
}

/** 저녁 리마인더 90분 뒤의 소셜 다이제스트 */
export interface SocialDigestJobData {
  readonly timezone: string;
  /** 배포 전에 등록된 지연 작업은 없을 수 있어 optional로 읽는다 */
  readonly recipientUserIds?: readonly string[];
}

export interface TargetedSocialDigestJobData extends SocialDigestJobData {
  readonly recipientUserIds: readonly string[];
}

// 등록 실패가 호출자(설정 변경·sweep)를 막지 않게 기다리지 않는다
export abstract class TimezoneReminderEnqueuerPort {
  abstract enqueueReminderHourChanged(payload: ReminderHourChangedJobData): void;
  abstract enqueueSocialDigest(payload: TargetedSocialDigestJobData): void;
}
