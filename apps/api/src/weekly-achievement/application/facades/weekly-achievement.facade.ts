import { Injectable } from "@nestjs/common";
import type {
	WeekLabelLocale,
	WeeklyAchievementUpsert,
	WeeklyAchievementView,
} from "../../domain/weekly-achievement";
import { GetWeeklyAchievementUseCase } from "../queries/get-weekly-achievement/get-weekly-achievement.use-case";
import {
	GetWeeklyAchievementsUseCase,
	type WeeklyAchievementListView,
} from "../queries/get-weekly-achievements/get-weekly-achievements.use-case";
import { UpsertWeeklyAchievementsUseCase } from "../use-cases/upsert-weekly-achievements/upsert-weekly-achievements.use-case";

/**
 * 주간 달성 애플리케이션 서비스(Facade) — 컨트롤러·스케줄러와 use-case 사이의 얇은 seam.
 *
 * 조회는 쿼리 use-case, 일괄 upsert는 커맨드 use-case로 흡수한다. 스케줄러(미이관 모듈)는
 * 이 Facade를 배럴로 주입해 upsertMany를 호출한다.
 */
@Injectable()
export class WeeklyAchievementFacade {
	constructor(
		private readonly getWeeklyAchievementsUseCase: GetWeeklyAchievementsUseCase,
		private readonly getWeeklyAchievementUseCase: GetWeeklyAchievementUseCase,
		private readonly upsertWeeklyAchievementsUseCase: UpsertWeeklyAchievementsUseCase,
	) {}

	getWeeklyAchievements(
		userId: string,
		year: number,
		cursor: number | undefined,
		size: number | undefined,
		locale: WeekLabelLocale,
	): Promise<WeeklyAchievementListView> {
		return this.getWeeklyAchievementsUseCase.execute({
			userId,
			year,
			cursor,
			size,
			locale,
		});
	}

	getWeeklyAchievement(
		userId: string,
		year: number,
		week: number,
		locale: WeekLabelLocale,
	): Promise<WeeklyAchievementView> {
		return this.getWeeklyAchievementUseCase.execute({
			userId,
			year,
			week,
			locale,
		});
	}

	upsertMany(records: WeeklyAchievementUpsert[]): Promise<void> {
		return this.upsertWeeklyAchievementsUseCase.execute({ records });
	}
}
