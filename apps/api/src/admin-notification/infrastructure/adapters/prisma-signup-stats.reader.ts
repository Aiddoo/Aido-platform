import { Injectable } from "@nestjs/common";

import { DatabaseService } from "@/shared/infrastructure/database/database.service";

import type {
	SignupStats,
	SignupStatsReaderPort,
} from "../../application/ports/signup-stats.reader.port";

/**
 * Prisma 가입 통계 리더.
 *
 * Account.provider별 가입자 수와 총 사용자 수를 조회한다.
 */
@Injectable()
export class PrismaSignupStatsReader implements SignupStatsReaderPort {
	constructor(private readonly database: DatabaseService) {}

	async getSignupStats(startUtc: Date, endUtc: Date): Promise<SignupStats> {
		const signupsByProvider = await this.database.account.groupBy({
			by: ["provider"],
			where: {
				createdAt: { gte: startUtc, lt: endUtc },
			},
			_count: true,
		});

		const totalUsers = await this.database.user.count();

		return {
			signupsByProvider: signupsByProvider.map((group) => ({
				provider: group.provider,
				count: group._count,
			})),
			totalUsers,
		};
	}
}
