/** 오늘(요청 시간대 달력) 보낸 횟수와 다음 초기화 시각 */
export interface DailySendUsage {
  readonly used: number;
  readonly resetsAt: Date;
}

export const CHEER_USAGE_READER = Symbol("CHEER_USAGE_READER");
export const NUDGE_USAGE_READER = Symbol("NUDGE_USAGE_READER");

/** 응원·찌르기의 일간 사용량. 보내기 한도 검사와 같은 하루 창을 쓴다. */
export interface DailySendUsageReaderPort {
  readDailyUsage(userId: string, timezone: string): Promise<DailySendUsage>;
}
