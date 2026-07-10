import { Inject, Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import type { WeeklyAchievement } from "@/generated/prisma/client";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import type { UpsertWeeklyAchievementParams } from "./types/weekly-achievement.types";

/**
 * 트랜잭션은 CLS로 전파됩니다 — TransactionHost.tx가 활성 트랜잭션 클라이언트를,
 * 활성 트랜잭션이 없으면 베이스 DatabaseService를 반환합니다.
 */
@Injectable()
export class WeeklyAchievementRepository {
	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
	) {}

	/** 활성 트랜잭션(없으면 베이스 클라이언트) */
	private get client() {
		return this.txHost.tx;
	}

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
		return this.client.weeklyAchievement.findMany({
			where: { userId, year },
			orderBy: { week: "desc" },
			take,
			...(cursor != null && {
				skip: 1,
				cursor: { userId_year_week: { userId, year, week: cursor } },
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
		return this.client.weeklyAchievement.findMany({
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
		return this.client.weeklyAchievement.findUnique({
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

		return this.client.weeklyAchievement.upsert({
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

		await this.uow.run(async () => {
			for (const {
				userId,
				year,
				week,
				totalTodos,
				completedTodos,
				achievedAt,
			} of paramsList) {
				await this.client.weeklyAchievement.upsert({
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
				});
			}
		});
	}
}
