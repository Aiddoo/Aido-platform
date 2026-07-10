import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import type { Cheer } from "@/generated/prisma/client";
import { addDays } from "@/shared/domain/date/utils/arithmetic";
import { now } from "@/shared/domain/date/utils/core";
import { startOfDay } from "@/shared/domain/date/utils/range";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { USER_BRIEF_SELECT } from "@/shared/infrastructure/database/selects";

import type {
	CheckCooldownParams,
	CheckDailyLimitParams,
	CheerWithRelations,
	FindCheersParams,
} from "./types";

/**
 * 트랜잭션은 CLS로 전파됩니다 — TransactionHost.tx가 활성 트랜잭션 클라이언트를,
 * 활성 트랜잭션이 없으면 베이스 DatabaseService를 반환합니다(기존 `tx ?? this.database`와 등가).
 */
@Injectable()
export class CheerRepository {
	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
	) {}

	/** 활성 트랜잭션(없으면 베이스 클라이언트) */
	private get client() {
		return this.txHost.tx;
	}

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
	async findById(id: number): Promise<Cheer | null> {
		return this.client.cheer.findUnique({
			where: { id },
		});
	}

	/**
	 * Cheer 읽음 처리
	 */
	async markAsRead(id: number): Promise<Cheer> {
		return this.client.cheer.update({
			where: { id },
			data: { readAt: now() },
		});
	}

	/**
	 * 여러 Cheer 읽음 처리
	 */
	async markManyAsRead(ids: number[], receiverId: string): Promise<number> {
		const result = await this.client.cheer.updateMany({
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
	): Promise<CheerWithRelations[]> {
		const { userId, cursor, size } = params;

		return this.client.cheer.findMany({
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

		return this.client.cheer.findMany({
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
	async countTodayCheers(params: CheckDailyLimitParams): Promise<number> {
		const { senderId, date } = params;

		const dayStart = startOfDay(date);
		const dayEnd = addDays(1, dayStart);

		return this.client.cheer.count({
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

		return this.client.cheer.findFirst({
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
	async countReceived(userId: string): Promise<number> {
		return this.client.cheer.count({
			where: { receiverId: userId },
		});
	}

	/**
	 * 보낸 Cheer 총 개수
	 */
	async countSent(userId: string): Promise<number> {
		return this.client.cheer.count({
			where: { senderId: userId },
		});
	}

	/**
	 * 읽지 않은 받은 Cheer 개수
	 */
	async countUnreadReceived(userId: string): Promise<number> {
		return this.client.cheer.count({
			where: { receiverId: userId, readAt: null },
		});
	}

	/**
	 * 특정 시점 이후 보낸 Cheer 수 (트랜잭션 내 일일 제한 체크용)
	 */
	async countSentSince(senderId: string, since: Date): Promise<number> {
		return this.client.cheer.count({
			where: {
				senderId,
				createdAt: { gte: since },
			},
		});
	}

	/**
	 * Cheer 생성 (관계 데이터 포함)
	 */
	async createWithRelations(data: {
		senderId: string;
		receiverId: string;
		message?: string;
	}): Promise<CheerWithRelations> {
		return this.client.cheer.create({
			data: {
				sender: { connect: { id: data.senderId } },
				receiver: { connect: { id: data.receiverId } },
				message: data.message,
			},
			include: this.#cheerInclude,
		});
	}
}
