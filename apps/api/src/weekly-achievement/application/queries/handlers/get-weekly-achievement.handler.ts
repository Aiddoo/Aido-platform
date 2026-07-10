import { ErrorCode } from "@aido/errors";
import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import {
	toWeeklyAchievementView,
	type WeeklyAchievementView,
} from "../../../domain/weekly-achievement";
import {
	WEEKLY_ACHIEVEMENT_REPOSITORY,
	type WeeklyAchievementRepositoryPort,
} from "../../ports/weekly-achievement.repository.port";
import { GetWeeklyAchievementQuery } from "../get-weekly-achievement.query";

@QueryHandler(GetWeeklyAchievementQuery)
export class GetWeeklyAchievementHandler
	implements IQueryHandler<GetWeeklyAchievementQuery, WeeklyAchievementView>
{
	constructor(
		@Inject(WEEKLY_ACHIEVEMENT_REPOSITORY)
		private readonly repository: WeeklyAchievementRepositoryPort,
	) {}

	async execute(
		query: GetWeeklyAchievementQuery,
	): Promise<WeeklyAchievementView> {
		const { userId, year, week, locale } = query;

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
