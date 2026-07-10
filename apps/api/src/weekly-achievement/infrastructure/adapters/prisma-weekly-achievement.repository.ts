import { Inject, Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import type { WeeklyAchievementRepositoryPort } from "../../application/ports/weekly-achievement.repository.port";
import type {
	WeeklyAchievementRow,
	WeeklyAchievementUpsert,
} from "../../domain/weekly-achievement";

/** 응답 뷰가 요구하는 컬럼만 선택 (userId·타임스탬프 제외) */
const ROW_SELECT = {
	id: true,
	year: true,
	week: true,
	totalTodos: true,
	completedTodos: true,
	achievedAt: true,
} as const;

/**
 * WeeklyAchievementRepositoryPort의 Prisma 어댑터.
 *
 * 트랜잭션은 CLS로 전파된다 — TransactionHost.tx가 활성 트랜잭션(없으면 베이스)을
 * 반환하며, 일괄 upsert는 UnitOfWork로 원자성을 보장한다.
 */
@Injectable()
export class PrismaWeeklyAchievementRepository
	implements WeeklyAchievementRepositoryPort
{
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

	findByYear(
		userId: string,
		year: number,
		cursor: number | undefined,
		take: number,
	): Promise<WeeklyAchievementRow[]> {
		return this.client.weeklyAchievement.findMany({
			where: { userId, year },
			orderBy: { week: "desc" },
			take,
			select: ROW_SELECT,
			...(cursor != null && {
				skip: 1,
				cursor: { userId_year_week: { userId, year, week: cursor } },
			}),
		});
	}

	findAllByYear(userId: string, year: number): Promise<WeeklyAchievementRow[]> {
		return this.client.weeklyAchievement.findMany({
			where: { userId, year },
			orderBy: [{ week: "asc" }],
			select: ROW_SELECT,
		});
	}

	findByYearAndWeek(
		userId: string,
		year: number,
		week: number,
	): Promise<WeeklyAchievementRow | null> {
		return this.client.weeklyAchievement.findUnique({
			where: { userId_year_week: { userId, year, week } },
			select: ROW_SELECT,
		});
	}

	async upsertMany(snapshots: WeeklyAchievementUpsert[]): Promise<void> {
		if (snapshots.length === 0) {
			return;
		}

		await this.uow.run(async () => {
			for (const {
				userId,
				year,
				week,
				totalTodos,
				completedTodos,
				achievedAt,
			} of snapshots) {
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
