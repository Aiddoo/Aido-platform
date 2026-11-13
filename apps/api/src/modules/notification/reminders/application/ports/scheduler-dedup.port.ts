// 단계·주 단위로 한 번만 보내는 재유입 알림의 발송 기록
export abstract class SchedulerDedupPort {
  /** 받은 단계 중 이미 보낸 것의 사용자 ID */
  abstract findSentWinbackStages(
    records: ReadonlyArray<{ userId: string; stage: string }>,
  ): Promise<Set<string>>;
  abstract recordWinbackStages(records: Array<{ userId: string; stage: string }>): Promise<void>;
  abstract findSentNudgePairs(weekId: string, pairs: string[]): Promise<Set<string>>;
  abstract recordNudgePairs(weekId: string, pairs: string[]): Promise<void>;
}
