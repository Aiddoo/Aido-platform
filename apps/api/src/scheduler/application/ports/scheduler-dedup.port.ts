export const SCHEDULER_DEDUP = Symbol("SCHEDULER_DEDUP");

export interface SchedulerDedupPort {
	hasWinbackStage(userId: string, stage: string): Promise<boolean>;
	recordWinbackStages(
		records: Array<{ userId: string; stage: string }>,
	): Promise<void>;
	findSentNudgePairs(weekId: string, pairs: string[]): Promise<Set<string>>;
	recordNudgePairs(weekId: string, pairs: string[]): Promise<void>;
}
