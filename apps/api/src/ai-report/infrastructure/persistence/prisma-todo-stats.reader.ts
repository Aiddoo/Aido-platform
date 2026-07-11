import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";

import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import type { TodoStatsReaderPort } from "../../application/ports/todo-stats.reader.port";
import type { AggregateParams, AggregationInputs } from "../../domain/types";

/**
 * 할 일 통계 읽기 Prisma 어댑터.
 *
 * 리포트 집계에 필요한 할 일/카테고리 원시 그룹 집계를 병렬로 조회한다(N+1 방지).
 * 트랜잭션은 CLS로 전파된다.
 */
@Injectable()
export class PrismaTodoStatsReader implements TodoStatsReaderPort {
	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
	) {}

	/** 활성 트랜잭션(없으면 베이스 클라이언트) — CLS로 전파됩니다 */
	private get database() {
		return this.txHost.tx;
	}

	async fetchAggregationInputs(
		params: AggregateParams,
	): Promise<AggregationInputs> {
		const { userId, startDate, endDate, prevStartDate, prevEndDate } = params;

		// 병렬로 모든 DB 쿼리 실행 (N+1 방지)
		const [
			dailyTotalGroups,
			dailyCompletedGroups,
			prevTotalCount,
			prevCompletedCount,
			catTotalGroups,
			catCompletedGroups,
			categories,
			completedTodos,
		] = await Promise.all([
			// 현재 기간: 날짜별 전체 할 일 수
			this.database.todo.groupBy({
				by: ["startDate"],
				where: { userId, startDate: { gte: startDate, lt: endDate } },
				_count: { id: true },
			}),
			// 현재 기간: 날짜별 완료 할 일 수
			this.database.todo.groupBy({
				by: ["startDate"],
				where: {
					userId,
					startDate: { gte: startDate, lt: endDate },
					completed: true,
				},
				_count: { id: true },
			}),
			// 이전 기간: 전체 할 일 수
			this.database.todo.count({
				where: {
					userId,
					startDate: { gte: prevStartDate, lt: prevEndDate },
				},
			}),
			// 이전 기간: 완료 할 일 수
			this.database.todo.count({
				where: {
					userId,
					startDate: { gte: prevStartDate, lt: prevEndDate },
					completed: true,
				},
			}),
			// 카테고리별 전체 할 일 수
			this.database.todo.groupBy({
				by: ["categoryId"],
				where: { userId, startDate: { gte: startDate, lt: endDate } },
				_count: { id: true },
			}),
			// 카테고리별 완료 할 일 수
			this.database.todo.groupBy({
				by: ["categoryId"],
				where: {
					userId,
					startDate: { gte: startDate, lt: endDate },
					completed: true,
				},
				_count: { id: true },
			}),
			// 카테고리 정보
			this.database.todoCategory.findMany({
				where: { userId },
				select: { id: true, name: true, color: true },
			}),
			// 완료된 할 일 (시간대 분석용)
			this.database.todo.findMany({
				where: {
					userId,
					startDate: { gte: startDate, lt: endDate },
					completed: true,
					completedAt: { not: null },
				},
				select: { startDate: true, completedAt: true },
			}),
		]);

		return {
			dailyTotalGroups,
			dailyCompletedGroups,
			prevTotalCount,
			prevCompletedCount,
			catTotalGroups,
			catCompletedGroups,
			categories,
			completedTodos,
		};
	}
}
