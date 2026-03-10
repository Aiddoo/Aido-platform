import { Injectable } from "@nestjs/common";

import { DatabaseService } from "@/database/database.service";
import type { WeeklyAchievement } from "@/generated/prisma/client";
import type { UpsertWeeklyAchievementParams } from "./types/weekly-achievement.types";

@Injectable()
export class WeeklyAchievementRepository {
	constructor(private readonly database: DatabaseService) {}

	/**
	 * 연도별 주간 달성 기록을 커서 기반 페이지네이션으로 조회합니다.
	 * id 내림차순 (최신 주차 먼저)
	 */
	async findByYear(
		userId: string,
		year: number,
		cursor: number | undefined,
		take: number,
	): Promise<WeeklyAchievement[]> {
		return this.database.weeklyAchievement.findMany({
			where: { userId, year },
			orderBy: { id: "desc" },
			take,
			...(cursor != null && {
				skip: 1,
				cursor: { id: cursor },
			}),
		});
	}

	/**
	 * 특정 연도의 모든 주간 달성 기록을 조회합니다 (summary 계산용).
	 * week 오름차순 정렬
	 */
	async findAllByYear(
		userId: string,
		year: number,
	): Promise<WeeklyAchievement[]> {
		return this.database.weeklyAchievement.findMany({
			where: { userId, year },
			orderBy: [{ week: "asc" }],
		});
	}

	/**
	 * 특정 연도/주차의 달성 기록을 조회합니다.
	 */
	async findByYearAndWeek(
		userId: string,
		year: number,
		week: number,
	): Promise<WeeklyAchievement | null> {
		return this.database.weeklyAchievement.findUnique({
			where: {
				userId_year_week: { userId, year, week },
			},
		});
	}

	/**
	 * 주간 달성 기록을 생성하거나 업데이트합니다.
	 */
	async upsert(
		params: UpsertWeeklyAchievementParams,
	): Promise<WeeklyAchievement> {
		const { userId, year, week, totalTodos, completedTodos, achievedAt } =
			params;

		return this.database.weeklyAchievement.upsert({
			where: {
				userId_year_week: { userId, year, week },
			},
			create: { userId, year, week, totalTodos, completedTodos, achievedAt },
			update: { totalTodos, completedTodos, achievedAt },
		});
	}

	/**
	 * 여러 주간 달성 기록을 트랜잭션으로 일괄 upsert합니다.
	 */
	async upsertMany(paramsList: UpsertWeeklyAchievementParams[]): Promise<void> {
		if (paramsList.length === 0) return;

		await this.database.$transaction(
			paramsList.map(
				({ userId, year, week, totalTodos, completedTodos, achievedAt }) =>
					this.database.weeklyAchievement.upsert({
						where: { userId_year_week: { userId, year, week } },
						create: {
							userId,
							year,
							week,
							totalTodos,
							completedTodos,
							achievedAt,
						},
						update: { totalTodos, completedTodos, achievedAt },
					}),
			),
		);
	}
}
