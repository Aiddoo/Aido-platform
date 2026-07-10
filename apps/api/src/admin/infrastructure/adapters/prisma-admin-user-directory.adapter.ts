import { BROADCAST_TARGET_FILTER } from "@aido/validators";
import { Injectable } from "@nestjs/common";
import type { Prisma } from "@/generated/prisma/client";
import { subtractDays } from "@/shared/domain/date/utils/arithmetic";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";
import type { AdminUserDirectoryPort } from "../../application/ports/admin-user-directory.port";
import type { BroadcastTargetFilter } from "../../domain/broadcast-message";

const BROADCAST_BATCH_SIZE = 500;

/**
 * AdminUserDirectoryPort의 Prisma 어댑터.
 *
 * 대상 필터를 Prisma where 절로 변환하고, 커서 기반 배치 스트리밍으로
 * 대상 사용자 ID를 흘려보낸다. (필터 유효성은 도메인/Zod가 이미 보장)
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
		const base: Prisma.UserWhereInput = { deletedAt: null, status: "ACTIVE" };

		// 필터별 추가 조건 (Record가 모든 필터 값을 강제 — 누락 시 컴파일 에러)
		const extra: Record<BroadcastTargetFilter, Prisma.UserWhereInput> = {
			[BROADCAST_TARGET_FILTER.ALL]: {},
			[BROADCAST_TARGET_FILTER.WITH_PUSH_TOKEN]: { pushTokens: { some: {} } },
			[BROADCAST_TARGET_FILTER.ACTIVE_LAST_7_DAYS]: {
				lastLoginAt: { gte: subtractDays(7) },
			},
			[BROADCAST_TARGET_FILTER.ACTIVE_LAST_30_DAYS]: {
				lastLoginAt: { gte: subtractDays(30) },
			},
			[BROADCAST_TARGET_FILTER.SUBSCRIBERS]: { subscriptionStatus: "ACTIVE" },
		};

		return { ...base, ...extra[filter] };
	}
}
