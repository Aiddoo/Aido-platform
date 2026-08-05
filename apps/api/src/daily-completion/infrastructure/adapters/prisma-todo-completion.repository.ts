import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { toDateString } from "@/shared/domain/date/utils/format";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import type {
	AggregateByDateRangeParams,
	TodoCompletionRepositoryPort,
} from "../../application/ports/todo-completion.repository.port";
import type { TodoAggregateByDate } from "../../domain/daily-completion";

/**
 * TodoCompletionRepositoryPort의 Prisma 어댑터.
 *
 * Prisma groupBy로 DB 레벨에서 날짜별 집계를 수행한다(대량 데이터 최적화).
 * 트랜잭션은 CLS로 전파된다 — TransactionHost.tx가 활성 트랜잭션(없으면 베이스)을 반환.
 */
@Injectable()
export class PrismaTodoCompletionRepository
	implements TodoCompletionRepositoryPort
{
	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
	) {}

	private get client() {
		return this.txHost.tx;
	}

	async aggregateByDateRange(
		params: AggregateByDateRangeParams,
	): Promise<TodoAggregateByDate[]> {
		const { userId, startDate, endDate } = params;

		return this.#aggregate({
			userId,
			startDate: { gte: startDate, lt: endDate },
		});
	}

	async aggregatePublicByDateRange(
		params: AggregateByDateRangeParams,
	): Promise<TodoAggregateByDate[]> {
		const { userId, startDate, endDate } = params;

		return this.#aggregate({
			userId,
			visibility: "PUBLIC",
			startDate: { gte: startDate, lt: endDate },
		});
	}

	async #aggregate(whereClause: {
		userId: string;
		visibility?: "PUBLIC";
		startDate: { gte: Date; lt: Date };
	}): Promise<TodoAggregateByDate[]> {
		// 전체·완료·카테고리 색상 집계를 병렬 실행 (waterfall 제거)
		const [aggregations, completedAggregations, categoryColorResults] =
			await Promise.all([
				this.client.todo.groupBy({
					by: ["startDate"],
					where: whereClause,
					_count: { id: true },
				}),
				this.client.todo.groupBy({
					by: ["startDate"],
					where: { ...whereClause, completed: true },
					_count: { id: true },
				}),
				this.client.todo.findMany({
					where: whereClause,
					select: {
						startDate: true,
						category: { select: { color: true } },
					},
					distinct: ["startDate", "categoryId"],
				}),
			]);

		// 완료 수를 Map으로 (O(1) 조회)
		const completedMap = new Map(
			completedAggregations.map((item) => [
				toDateString(item.startDate),
				item._count.id,
			]),
		);

		// 카테고리 색상을 날짜별 Set으로 그룹화 (중복 색상 제거)
		const colorMap = new Map<string, Set<string>>();
		for (const item of categoryColorResults) {
			const key = toDateString(item.startDate);
			const colors = colorMap.get(key) ?? new Set<string>();
			colors.add(item.category.color);
			colorMap.set(key, colors);
		}

		return aggregations.map((item) => {
			const dateKey = toDateString(item.startDate);
			return {
				date: item.startDate,
				total: item._count.id,
				completed: completedMap.get(dateKey) ?? 0,
				categoryColors: [...(colorMap.get(dateKey) ?? [])],
			};
		});
	}
}
