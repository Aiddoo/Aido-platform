import { Injectable } from "@nestjs/common";
import { and } from "@prisma/orm-postgres/orm-client";

import { decodeRecord } from "#api/shared/infrastructure/database/database-records";
import { databaseTimestamp } from "#api/shared/infrastructure/database/database-values";
import { DatabaseService } from "#api/shared/infrastructure/database/database.service";

import type {
	SignupStats,
	SignupStatsReaderPort,
} from "../../application/ports/signup-stats.reader.port.js";

/**
 * Prisma 가입 통계 리더.
 *
 * Account.provider별 가입자 수와 총 사용자 수를 조회한다.
 */
@Injectable()
export class PrismaSignupStatsReader implements SignupStatsReaderPort {
	constructor(private readonly database: DatabaseService) {}

	async getSignupStats(startUtc: Date, endUtc: Date): Promise<SignupStats> {
		const signupsByProvider = await this.database.db.orm.public.Account.where((row) =>
			and(
				row.createdAt.gte(databaseTimestamp(startUtc)),
				row.createdAt.lt(databaseTimestamp(endUtc)),
			),
		)
			.groupBy("provider")
			.aggregate((aggregate) => ({ count: aggregate.count() }))
			.then((rows) => rows.map((row) => ({ ...decodeRecord("Account", row), _count: row.count })));

		// 플랫폼 내부 FK용 사용자는 가입자가 아니다. 실제 인증 계정이 생긴 사용자만 센다.
		const totalUsers = (
			await this.database.db.orm.public.User.where((row) => row.accounts.some()).aggregate(
				(aggregate) => ({ count: aggregate.count() }),
			)
		).count;

		return {
			signupsByProvider: signupsByProvider.map((group) => ({
				provider: group.provider,
				count: group._count,
			})),
			totalUsers,
		};
	}
}
