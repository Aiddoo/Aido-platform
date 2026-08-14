import { ErrorCode } from "@aido/errors";
import { Inject, Injectable } from "@nestjs/common";

import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import {
	toWeeklyAchievementView,
	type WeekLabelLocale,
	type WeeklyAchievementView,
} from "../../../domain/weekly-achievement";
import {
	WEEKLY_ACHIEVEMENT_REPOSITORY,
	type WeeklyAchievementRepositoryPort,
} from "../../ports/weekly-achievement.repository.port";

export interface GetWeeklyAchievementInput {
	userId: string;
	year: number;
	week: number;
	locale: WeekLabelLocale;
}

/**
 * 특정 연도/주차의 주간 달성 상세 조회 use-case (읽기 전용).
 */
@Injectable()
export class GetWeeklyAchievementUseCase {
	constructor(
		@Inject(WEEKLY_ACHIEVEMENT_REPOSITORY)
		private readonly repository: WeeklyAchievementRepositoryPort,
	) {}

	async execute(input: GetWeeklyAchievementInput): Promise<WeeklyAchievementView> {
		const { userId, year, week, locale } = input;

		const row = await this.repository.findByYearAndWeek(userId, year, week);

		if (!row) {
			throw new ApplicationException(ErrorCode.ACHIEVEMENT_1801, {
				year,
				week,
			});
		}

		return toWeeklyAchievementView(row, locale);
	}
}
