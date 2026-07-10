import { Injectable } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import type {
	WeekLabelLocale,
	WeeklyAchievementUpsert,
	WeeklyAchievementView,
} from "../../domain/weekly-achievement";
import { GetWeeklyAchievementQuery } from "../queries/get-weekly-achievement.query";
import {
	GetWeeklyAchievementsQuery,
	type WeeklyAchievementListView,
} from "../queries/get-weekly-achievements.query";
import { UpsertWeeklyAchievementsCommand } from "../use-cases/upsert-weekly-achievements/upsert-weekly-achievements.command";

/**
 * 주간 달성 애플리케이션 서비스(Facade) — 컨트롤러·스케줄러와 버스 사이의 얇은 seam.
 *
 * 조회는 QueryBus, 일괄 upsert는 CommandBus로 흡수한다. 스케줄러(미이관 모듈)는
 * 이 Facade를 배럴로 주입해 upsertMany를 호출한다.
 */
@Injectable()
export class WeeklyAchievementFacade {
	constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	getWeeklyAchievements(
		userId: string,
		year: number,
		cursor: number | undefined,
		size: number | undefined,
		locale: WeekLabelLocale,
	): Promise<WeeklyAchievementListView> {
		return this.queryBus.execute(
			new GetWeeklyAchievementsQuery(userId, year, cursor, size, locale),
		);
	}

	getWeeklyAchievement(
		userId: string,
		year: number,
		week: number,
		locale: WeekLabelLocale,
	): Promise<WeeklyAchievementView> {
		return this.queryBus.execute(
			new GetWeeklyAchievementQuery(userId, year, week, locale),
		);
	}

	upsertMany(records: WeeklyAchievementUpsert[]): Promise<void> {
		return this.commandBus.execute(
			new UpsertWeeklyAchievementsCommand(records),
		);
	}
}
