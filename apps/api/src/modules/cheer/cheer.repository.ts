import { Injectable } from "@nestjs/common";
import { addDays, startOfDay } from "@/common/date";
import { DatabaseService } from "@/database/database.service";
import type { Cheer } from "@/generated/prisma/client";

import type {
	CheckCooldownParams,
	CheckDailyLimitParams,
	CheerWithRelations,
	FindCheersParams,
} from "./types";

// =============================================================================
// Repository
// =============================================================================

@Injectable()
export class CheerRepository {
	constructor(private readonly database: DatabaseService) {}

	// Include 설정 (사용자 정보 포함)
	readonly #userSelect = {
		id: true,
		userTag: true,
		profile: {
			select: {
				name: true,
				profileImage: true,
			},
		},
	} as const;

	readonly #cheerInclude = {
		sender: {
			select: this.#userSelect,
		},
		receiver: {
			select: this.#userSelect,
		},
	} as const;

	// =========================================================================
	// 기본 CRUD
	// =========================================================================

	/**
	 * ID로 Cheer 조회
	 */
	async findById(id: number): Promise<Cheer | null> {
		return this.database.cheer.findUnique({
			where: { id },
		});
	}

	/**
	 * Cheer 읽음 처리
	 */
	async markAsRead(id: number): Promise<Cheer> {
		return this.database.cheer.update({
			where: { id },
			data: { readAt: new Date() },
		});
	}

	/**
	 * 여러 Cheer 읽음 처리
	 */
	async markManyAsRead(ids: number[], receiverId: string): Promise<number> {
		const result = await this.database.cheer.updateMany({
			where: {
				id: { in: ids },
				receiverId,
				readAt: null,
			},
			data: { readAt: new Date() },
		});
		return result.count;
	}

	// =========================================================================
	// 목록 조회
	// =========================================================================

	/**
	 * 받은 Cheer 목록 조회
	 */
	async findReceivedCheers(
		params: FindCheersParams,
	): Promise<CheerWithRelations[]> {
		const { userId, cursor, size } = params;

		return this.database.cheer.findMany({
			where: {
				receiverId: userId,
			},
			include: this.#cheerInclude,
			take: size + 1,
			...(cursor != null && {
				skip: 1,
				cursor: { id: cursor },
			}),
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		});
	}

	/**
	 * 보낸 Cheer 목록 조회
	 */
	async findSentCheers(
		params: FindCheersParams,
	): Promise<CheerWithRelations[]> {
		const { userId, cursor, size } = params;

		return this.database.cheer.findMany({
			where: {
				senderId: userId,
			},
			include: this.#cheerInclude,
			take: size + 1,
			...(cursor != null && {
				skip: 1,
				cursor: { id: cursor },
			}),
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		});
	}

	// =========================================================================
	// 제한 및 쿨다운 체크
	// =========================================================================

	/**
	 * 오늘 보낸 Cheer 수 조회 (일일 제한 체크용)
	 */
	async countTodayCheers(params: CheckDailyLimitParams): Promise<number> {
		const { senderId, date } = params;

		const dayStart = startOfDay(date);
		const dayEnd = addDays(1, dayStart);

		return this.database.cheer.count({
			where: {
				senderId,
				createdAt: {
					gte: dayStart,
					lt: dayEnd,
				},
			},
		});
	}

	/**
	 * 특정 사용자에게 보낸 마지막 Cheer 조회 (쿨다운 체크용)
	 */
	async findLastCheerToUser(
		params: CheckCooldownParams,
	): Promise<Cheer | null> {
		const { senderId, receiverId } = params;

		return this.database.cheer.findFirst({
			where: {
				senderId,
				receiverId,
			},
			orderBy: { createdAt: "desc" },
		});
	}
}
