import { Command } from "@nestjs/cqrs";
import type { WeeklyAchievementUpsert } from "../../../domain/weekly-achievement";

/**
 * 여러 주간 달성 기록을 일괄 upsert하는 커맨드 (스케줄러 배치에서 디스패치).
 */
export class UpsertWeeklyAchievementsCommand extends Command<void> {
	constructor(public readonly records: WeeklyAchievementUpsert[]) {
		super();
	}
}
