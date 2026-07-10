import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { buildWeeklyAchievementSnapshot } from "../../../domain/weekly-achievement";
import {
	WEEKLY_ACHIEVEMENT_REPOSITORY,
	type WeeklyAchievementRepositoryPort,
} from "../../ports/weekly-achievement.repository.port";
import { UpsertWeeklyAchievementsCommand } from "./upsert-weekly-achievements.command";

@CommandHandler(UpsertWeeklyAchievementsCommand)
export class UpsertWeeklyAchievementsHandler
	implements ICommandHandler<UpsertWeeklyAchievementsCommand, void>
{
	constructor(
		@Inject(WEEKLY_ACHIEVEMENT_REPOSITORY)
		private readonly repository: WeeklyAchievementRepositoryPort,
	) {}

	async execute(command: UpsertWeeklyAchievementsCommand): Promise<void> {
		if (command.records.length === 0) {
			return;
		}

		// 도메인 불변식(완료 수 ≤ 전체 수, 주차 범위) 검증 후 영속
		const snapshots = command.records.map(buildWeeklyAchievementSnapshot);
		await this.repository.upsertMany(snapshots);
	}
}
