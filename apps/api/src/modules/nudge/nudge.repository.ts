import { Injectable } from "@nestjs/common";
import { addDays } from "@/common/date/utils/arithmetic";
import { startOfDay } from "@/common/date/utils/range";
import { DatabaseService } from "@/database/database.service";
import type { Nudge } from "@/generated/prisma/client";

import type {
	CheckCooldownParams,
	CheckDailyLimitParams,
	FindNudgesParams,
	NudgeWithRelations,
} from "./types";

// =============================================================================
// Repository
// =============================================================================

@Injectable()
export class NudgeRepository {
	constructor(private readonly database: DatabaseService) {}

	// Include 설정 (사용자 및 Todo 정보 포함)
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

	readonly #todoSelect = {
		id: true,
		title: true,
		completed: true,
	} as const;

	readonly #nudgeInclude = {
		sender: {
			select: this.#userSelect,
		},
		receiver: {
			select: this.#userSelect,
		},
		todo: {
			select: this.#todoSelect,
		},
	} as const;

	// =========================================================================
	// 기본 CRUD
	// =========================================================================

	/**
	 * ID로 Nudge 조회
	 */
	async findById(id: number): Promise<Nudge | null> {
		return this.database.nudge.findUnique({
			where: { id },
		});
	}

	/**
	 * Nudge 읽음 처리
	 */
	async markAsRead(id: number): Promise<Nudge> {
		return this.database.nudge.update({
			where: { id },
			data: { readAt: new Date() },
		});
	}

	// =========================================================================
	// 목록 조회
	// =========================================================================

	/**
	 * 받은 Nudge 목록 조회
	 */
	async findReceivedNudges(
		params: FindNudgesParams,
	): Promise<NudgeWithRelations[]> {
		const { userId, cursor, size } = params;

		return this.database.nudge.findMany({
			where: {
				receiverId: userId,
			},
			include: this.#nudgeInclude,
			take: size + 1,
			...(cursor != null && {
				skip: 1,
				cursor: { id: cursor },
			}),
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		});
	}

	/**
	 * 보낸 Nudge 목록 조회
	 */
	async findSentNudges(
		params: FindNudgesParams,
	): Promise<NudgeWithRelations[]> {
		const { userId, cursor, size } = params;

		return this.database.nudge.findMany({
			where: {
				senderId: userId,
			},
			include: this.#nudgeInclude,
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
	 * 오늘 보낸 Nudge 수 조회 (일일 제한 체크용)
	 */
	async countTodayNudges(params: CheckDailyLimitParams): Promise<number> {
		const { senderId, date } = params;

		const dayStart = startOfDay(date);
		const dayEnd = addDays(1, dayStart);

		return this.database.nudge.count({
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
	 * 특정 Todo에 대한 마지막 Nudge 조회 (쿨다운 체크용)
	 */
	async findLastNudgeForTodo(
		params: CheckCooldownParams,
	): Promise<Nudge | null> {
		const { senderId, todoId } = params;

		return this.database.nudge.findFirst({
			where: {
				senderId,
				todoId,
			},
			orderBy: { createdAt: "desc" },
		});
	}

	/**
	 * 특정 사용자에게 보낸 마지막 Nudge 조회 (쿨다운 체크용)
	 */
	async findLastNudgeToUser(
		senderId: string,
		receiverId: string,
	): Promise<Nudge | null> {
		return this.database.nudge.findFirst({
			where: {
				senderId,
				receiverId,
			},
			orderBy: { createdAt: "desc" },
		});
	}
}
