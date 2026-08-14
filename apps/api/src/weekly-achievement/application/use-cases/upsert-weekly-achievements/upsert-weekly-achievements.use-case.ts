import { Inject, Injectable } from "@nestjs/common";

import {
	buildWeeklyAchievementSnapshot,
	type WeeklyAchievementUpsert,
} from "../../../domain/weekly-achievement";
import {
	WEEKLY_ACHIEVEMENT_REPOSITORY,
	type WeeklyAchievementRepositoryPort,
} from "../../ports/weekly-achievement.repository.port";

export interface UpsertWeeklyAchievementsInput {
	records: WeeklyAchievementUpsert[];
}

/**
 * 여러 주간 달성 기록을 일괄 upsert하는 use-case (스케줄러 배치에서 호출).
 */
@Injectable()
export class UpsertWeeklyAchievementsUseCase {
	constructor(
		@Inject(WEEKLY_ACHIEVEMENT_REPOSITORY)
		private readonly repository: WeeklyAchievementRepositoryPort,
	) {}

	async execute(input: UpsertWeeklyAchievementsInput): Promise<void> {
		if (input.records.length === 0) {
			return;
		}

		// 도메인 불변식(완료 수 ≤ 전체 수, 주차 범위) 검증 후 영속
		const snapshots = input.records.map(buildWeeklyAchievementSnapshot);
		await this.repository.upsertMany(snapshots);
	}
}
