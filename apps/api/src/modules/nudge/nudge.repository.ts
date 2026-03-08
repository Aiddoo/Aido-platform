import { Injectable } from "@nestjs/common";
import { USER_BRIEF_SELECT } from "@/common/database/selects";
import { addDays } from "@/common/date/utils/arithmetic";
import { now } from "@/common/date/utils/core";
import { startOfDay } from "@/common/date/utils/range";
import { DatabaseService } from "@/database/database.service";
import type { Nudge } from "@/generated/prisma/client";

import type {
	CheckCooldownParams,
	CheckDailyLimitParams,
	FindNudgesParams,
	NudgeWithRelations,
} from "./types";

@Injectable()
export class NudgeRepository {
	constructor(private readonly database: DatabaseService) {}

	readonly #todoSelect = {
		id: true,
		title: true,
		completed: true,
	} as const;

	readonly #nudgeInclude = {
		sender: {
			select: USER_BRIEF_SELECT,
		},
		receiver: {
			select: USER_BRIEF_SELECT,
		},
		todo: {
			select: this.#todoSelect,
		},
	} as const;

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
			data: { readAt: now() },
		});
	}

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

	/**
	 * 받은 Nudge 총 개수
	 */
	async countReceived(userId: string): Promise<number> {
		return this.database.nudge.count({
			where: { receiverId: userId },
		});
	}

	/**
	 * 보낸 Nudge 총 개수
	 */
	async countSent(userId: string): Promise<number> {
		return this.database.nudge.count({
			where: { senderId: userId },
		});
	}

	/**
	 * 읽지 않은 받은 Nudge 개수
	 */
	async countUnreadReceived(userId: string): Promise<number> {
		return this.database.nudge.count({
			where: { receiverId: userId, readAt: null },
		});
	}
}
