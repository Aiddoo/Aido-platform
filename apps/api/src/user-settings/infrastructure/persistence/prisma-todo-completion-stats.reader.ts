import { Injectable } from "@nestjs/common";
import { and } from "@prisma/orm-postgres/orm-client";
import { sumBy } from "es-toolkit";

import { databaseDate } from "#api/shared/infrastructure/database/database-values";
import { DatabaseService } from "#api/shared/infrastructure/database/database.service";

import type {
	TodoCompletionStats,
	TodoCompletionStatsReaderPort,
} from "../../application/ports/todo-completion-stats.reader.port.js";

/**
 * Prisma 투두 완료 통계 리더.
 *
 * 스트릭 갱신용으로 특정 날짜의 투두 총계/완료 수를 직접 집계한다
 * (todo 모듈 순환 회피).
 */
@Injectable()
export class PrismaTodoCompletionStatsReader implements TodoCompletionStatsReaderPort {
	constructor(private readonly database: DatabaseService) {}

	async countForDay(userId: string, dayStart: Date, dayEnd: Date): Promise<TodoCompletionStats> {
		const groups = await this.database.db.orm.public.Todo.where((todo) =>
			and(
				todo.userId.eq(userId),
				todo.startDate.gte(databaseDate(dayStart)),
				todo.startDate.lt(databaseDate(dayEnd)),
			),
		)
			.groupBy("completed")
			.aggregate((aggregate) => ({ count: aggregate.count() }));
		return {
			total: sumBy(groups, (group) => group.count),
			completed: groups.find((group) => group.completed)?.count ?? 0,
		};
	}
}
