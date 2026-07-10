import { BROADCAST_TARGET_FILTER } from "@aido/validators";
import { Injectable } from "@nestjs/common";
import type { Prisma } from "@/generated/prisma/client";
import { BusinessExceptions } from "@/shared/application/exceptions/business-exception.service";
import { subtractDays } from "@/shared/domain/date/utils/arithmetic";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";
import type {
	AdminUserDirectoryPort,
	BroadcastTargetFilter,
} from "../../application/ports/admin-user-directory.port";

const BROADCAST_BATCH_SIZE = 500;

/**
 * AdminUserDirectoryPort의 Prisma 어댑터.
 *
 * 대상 필터를 Prisma where 절로 변환하고, 커서 기반 배치 스트리밍으로
 * 대상 사용자 ID를 흘려보낸다.
 */
@Injectable()
export class PrismaAdminUserDirectoryAdapter implements AdminUserDirectoryPort {
	constructor(private readonly database: DatabaseService) {}

	async *streamTargetUserIds(
		filter: BroadcastTargetFilter,
	): AsyncIterable<string[]> {
		const where = this.#buildTargetWhere(filter);
		let cursor: string | undefined;

		for (;;) {
			const rows = await this.database.user.findMany({
				where: { ...where, ...(cursor && { id: { gt: cursor } }) },
				select: { id: true },
				orderBy: { id: "asc" },
				take: BROADCAST_BATCH_SIZE,
			});

			if (rows.length === 0) {
				break;
			}

			yield rows.map((row) => row.id);

			const last = rows.at(-1);
			if (rows.length < BROADCAST_BATCH_SIZE || !last) {
				break;
			}
			cursor = last.id;
		}
	}

	async findExistingUserIds(userIds: string[]): Promise<string[]> {
		const rows = await this.database.user.findMany({
			where: { id: { in: userIds }, deletedAt: null },
			select: { id: true },
		});
		return rows.map((row) => row.id);
	}

	#buildTargetWhere(filter: BroadcastTargetFilter): Prisma.UserWhereInput {
		const baseWhere: Prisma.UserWhereInput = {
			deletedAt: null,
			status: "ACTIVE",
		};

		switch (filter) {
			case BROADCAST_TARGET_FILTER.ALL:
				return baseWhere;

			case BROADCAST_TARGET_FILTER.WITH_PUSH_TOKEN:
				return { ...baseWhere, pushTokens: { some: {} } };

			case BROADCAST_TARGET_FILTER.ACTIVE_LAST_7_DAYS:
				return { ...baseWhere, lastLoginAt: { gte: subtractDays(7) } };

			case BROADCAST_TARGET_FILTER.ACTIVE_LAST_30_DAYS:
				return { ...baseWhere, lastLoginAt: { gte: subtractDays(30) } };

			case BROADCAST_TARGET_FILTER.SUBSCRIBERS:
				return { ...baseWhere, subscriptionStatus: "ACTIVE" };

			default:
				throw BusinessExceptions.adminInvalidFilterCondition({
					targetFilter: filter,
				});
		}
	}
}
