import { Injectable } from "@nestjs/common";
import type { TransactionClient } from "@/common/database";
import { USER_BRIEF_SELECT } from "@/common/database/selects";
import { addDays } from "@/common/date/utils/arithmetic";
import { now } from "@/common/date/utils/core";
import { startOfDay } from "@/common/date/utils/range";
import { DatabaseService } from "@/database/database.service";
import type { Cheer } from "@/generated/prisma/client";

import type {
	CheckCooldownParams,
	CheckDailyLimitParams,
	CheerWithRelations,
	FindCheersParams,
} from "./types";

@Injectable()
export class CheerRepository {
	constructor(private readonly database: DatabaseService) {}

	readonly #cheerInclude = {
		sender: {
			select: USER_BRIEF_SELECT,
		},
		receiver: {
			select: USER_BRIEF_SELECT,
		},
	} as const;

	/**
	 * ID로 Cheer 조회
	 */
	async findById(id: number, tx?: TransactionClient): Promise<Cheer | null> {
		const client = tx ?? this.database;
		return client.cheer.findUnique({
			where: { id },
		});
	}

	/**
	 * Cheer 읽음 처리
	 */
	async markAsRead(id: number, tx?: TransactionClient): Promise<Cheer> {
		const client = tx ?? this.database;
		return client.cheer.update({
			where: { id },
			data: { readAt: now() },
		});
	}

	/**
	 * 여러 Cheer 읽음 처리
	 */
	async markManyAsRead(
		ids: number[],
		receiverId: string,
		tx?: TransactionClient,
	): Promise<number> {
		const client = tx ?? this.database;
		const result = await client.cheer.updateMany({
			where: {
				id: { in: ids },
				receiverId,
				readAt: null,
			},
			data: { readAt: now() },
		});
		return result.count;
	}

	/**
	 * 받은 Cheer 목록 조회
	 */
	async findReceivedCheers(
		params: FindCheersParams,
		tx?: TransactionClient,
	): Promise<CheerWithRelations[]> {
		const client = tx ?? this.database;
		const { userId, cursor, size } = params;

		return client.cheer.findMany({
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
		tx?: TransactionClient,
	): Promise<CheerWithRelations[]> {
		const client = tx ?? this.database;
		const { userId, cursor, size } = params;

		return client.cheer.findMany({
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

	/**
	 * 오늘 보낸 Cheer 수 조회 (일일 제한 체크용)
	 */
	async countTodayCheers(
		params: CheckDailyLimitParams,
		tx?: TransactionClient,
	): Promise<number> {
		const client = tx ?? this.database;
		const { senderId, date } = params;

		const dayStart = startOfDay(date);
		const dayEnd = addDays(1, dayStart);

		return client.cheer.count({
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
		tx?: TransactionClient,
	): Promise<Cheer | null> {
		const client = tx ?? this.database;
		const { senderId, receiverId } = params;

		return client.cheer.findFirst({
			where: {
				senderId,
				receiverId,
			},
			orderBy: { createdAt: "desc" },
		});
	}

	/**
	 * 받은 Cheer 총 개수
	 */
	async countReceived(userId: string, tx?: TransactionClient): Promise<number> {
		const client = tx ?? this.database;
		return client.cheer.count({
			where: { receiverId: userId },
		});
	}

	/**
	 * 보낸 Cheer 총 개수
	 */
	async countSent(userId: string, tx?: TransactionClient): Promise<number> {
		const client = tx ?? this.database;
		return client.cheer.count({
			where: { senderId: userId },
		});
	}

	/**
	 * 읽지 않은 받은 Cheer 개수
	 */
	async countUnreadReceived(
		userId: string,
		tx?: TransactionClient,
	): Promise<number> {
		const client = tx ?? this.database;
		return client.cheer.count({
			where: { receiverId: userId, readAt: null },
		});
	}

	/**
	 * 특정 시점 이후 보낸 Cheer 수 (트랜잭션 내 일일 제한 체크용)
	 */
	async countSentSince(
		senderId: string,
		since: Date,
		tx?: TransactionClient,
	): Promise<number> {
		const client = tx ?? this.database;
		return client.cheer.count({
			where: {
				senderId,
				createdAt: { gte: since },
			},
		});
	}

	/**
	 * Cheer 생성 (관계 데이터 포함)
	 */
	async createWithRelations(
		data: { senderId: string; receiverId: string; message?: string },
		tx?: TransactionClient,
	): Promise<CheerWithRelations> {
		const client = tx ?? this.database;
		return client.cheer.create({
			data: {
				sender: { connect: { id: data.senderId } },
				receiver: { connect: { id: data.receiverId } },
				message: data.message,
			},
			include: this.#cheerInclude,
		});
	}
}
