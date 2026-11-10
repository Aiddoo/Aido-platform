// 단계·주 단위로 한 번만 보내는 재유입 알림의 발송 기록
export abstract class SchedulerDedupPort {
  abstract hasWinbackStage(userId: string, stage: string): Promise<boolean>;
  abstract recordWinbackStages(records: Array<{ userId: string; stage: string }>): Promise<void>;
  abstract findSentNudgePairs(weekId: string, pairs: string[]): Promise<Set<string>>;
  abstract recordNudgePairs(weekId: string, pairs: string[]): Promise<void>;
}
