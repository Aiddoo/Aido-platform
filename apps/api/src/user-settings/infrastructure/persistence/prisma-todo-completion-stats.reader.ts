import { Injectable } from "@nestjs/common";

import { DatabaseService } from "@/shared/infrastructure/database";

import type {
	TodoCompletionStats,
	TodoCompletionStatsReaderPort,
} from "../../application/ports/todo-completion-stats.reader.port";

/**
 * Prisma 투두 완료 통계 리더.
 *
 * 스트릭 갱신용으로 특정 날짜의 투두 총계/완료 수를 직접 집계한다
 * (todo 모듈 순환 회피).
 */
@Injectable()
export class PrismaTodoCompletionStatsReader
	implements TodoCompletionStatsReaderPort
{
	constructor(private readonly database: DatabaseService) {}

	async countForDay(
		userId: string,
		dayStart: Date,
		dayEnd: Date,
	): Promise<TodoCompletionStats> {
		const where = {
			userId,
			startDate: { gte: dayStart, lt: dayEnd },
		};

		const [total, completed] = await Promise.all([
			this.database.todo.count({ where }),
			this.database.todo.count({ where: { ...where, completed: true } }),
		]);

		return { total, completed };
	}
}
