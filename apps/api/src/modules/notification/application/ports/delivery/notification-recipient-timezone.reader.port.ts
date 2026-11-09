export const NOTIFICATION_RECIPIENT_TIMEZONE_READER = Symbol(
  "NOTIFICATION_RECIPIENT_TIMEZONE_READER",
);

/** 알림 문구의 날짜·남은 일수를 받는 사람 달력으로 쓰기 위한 시간대 조회 capability. */
export interface NotificationRecipientTimezoneReaderPort {
  /** 저장값이 없거나 잘못됐으면 발송 판단과 같은 폴백(resolveDeliveryTimezone)을 쓴다. */
  getTimezones(userIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
}
