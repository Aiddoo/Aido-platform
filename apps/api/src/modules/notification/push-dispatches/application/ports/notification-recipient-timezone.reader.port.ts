// 알림 문구의 날짜·남은 일수를 받는 사람 달력으로 쓰려고 시간대를 읽는다
export abstract class NotificationRecipientTimezoneReaderPort {
  // 저장값이 없거나 잘못됐으면 발송 판단과 같은 폴백(resolveDeliveryTimezone)을 쓴다
  abstract getTimezones(userIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
}
