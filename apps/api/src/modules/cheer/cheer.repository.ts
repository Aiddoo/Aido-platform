import { Injectable } from "@nestjs/common";
import { DatabaseService } from "@/database/database.service";
import type { Cheer, Prisma } from "@/generated/prisma/client";

import type {
	CheckCooldownParams,
	CheckDailyLimitParams,
	CheerWithRelations,
	FindCheersParams,
	TransactionClient,
} from "./types";

// =============================================================================
// Repository
// =============================================================================

@Injectable()
export class CheerRepository {
	constructor(private readonly database: DatabaseService) {}

	// Include 설정 (사용자 정보 포함)
	private readonly userSelect = {
		id: true,
		userTag: true,
		profile: {
			select: {
				name: true,
				profileImage: true,
			},
		},
	} as const;

	private readonly cheerInclude = {
		sender: {
			select: this.userSelect,
		},
		receiver: {
			select: this.userSelect,
		},
	} as const;

	// =========================================================================
	// 기본 CRUD
	// =========================================================================

	/**
	 * Cheer 생성
	 */
	async create(
		data: Prisma.CheerCreateInput,
		tx?: TransactionClient,
	): Promise<Cheer> {
		const client = tx ?? this.database;
		return client.cheer.create({ data });
	}

	/**
	 * Cheer 생성 (관계 정보 포함 반환)
	 */
	async createWithRelations(
		data: Prisma.CheerCreateInput,
		tx?: TransactionClient,
	): Promise<CheerWithRelations> {
		const client = tx ?? this.database;
		return client.cheer.create({
			data,
			include: this.cheerInclude,
		});
	}

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
	 * ID로 Cheer 조회 (관계 정보 포함)
	 */
	async findByIdWithRelations(
		id: number,
		tx?: TransactionClient,
	): Promise<CheerWithRelations | null> {
		const client = tx ?? this.database;
		return client.cheer.findUnique({
			where: { id },
			include: this.cheerInclude,
		});
	}

	/**
	 * Cheer 읽음 처리
	 */
	async markAsRead(id: number, tx?: TransactionClient): Promise<Cheer> {
		const client = tx ?? this.database;
		return client.cheer.update({
			where: { id },
			data: { readAt: new Date() },
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
			include: this.cheerInclude,
			take: size + 1,
			...(cursor && {
				skip: 1,
				cursor: { id: cursor },
			}),
			orderBy: { createdAt: "desc" },
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
			include: this.cheerInclude,
			take: size + 1,
			...(cursor && {
				skip: 1,
				cursor: { id: cursor },
			}),
			orderBy: { createdAt: "desc" },
		});
	}

	/**
	 * 받은 Cheer 총 개수 조회
	 */
	async countReceivedCheers(userId: string): Promise<number> {
		return this.database.cheer.count({
			where: { receiverId: userId },
		});
	}

	/**
	 * 받은 Cheer 중 읽지 않은 개수 조회
	 */
	async countUnreadCheers(userId: string): Promise<number> {
		return this.database.cheer.count({
			where: {
				receiverId: userId,
				readAt: null,
			},
		});
	}

	/**
	 * 보낸 Cheer 총 개수 조회
	 */
	async countSentCheers(userId: string): Promise<number> {
		return this.database.cheer.count({
			where: { senderId: userId },
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

		// 해당 날짜의 시작과 끝
		const startOfDay = new Date(date);
		startOfDay.setHours(0, 0, 0, 0);
		const endOfDay = new Date(date);
		endOfDay.setHours(23, 59, 59, 999);

		return this.database.cheer.count({
			where: {
				senderId,
				createdAt: {
					gte: startOfDay,
					lte: endOfDay,
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

	// =========================================================================
	// 사용자 정보 조회
	// =========================================================================

	/**
	 * 사용자 존재 확인
	 */
	async userExists(userId: string): Promise<boolean> {
		const user = await this.database.user.findUnique({
			where: { id: userId },
			select: { id: true },
		});
		return user !== null;
	}

	/**
	 * 사용자 이름 조회 (알림용)
	 */
	async getUserName(userId: string): Promise<string | null> {
		const user = await this.database.user.findUnique({
			where: { id: userId },
			select: {
				profile: {
					select: { name: true },
				},
			},
		});
		return user?.profile?.name ?? null;
	}

	/**
	 * 사용자 구독 상태 조회
	 */
	async getUserSubscriptionStatus(
		userId: string,
	): Promise<"FREE" | "ACTIVE" | "EXPIRED" | "CANCELLED" | null> {
		const user = await this.database.user.findUnique({
			where: { id: userId },
			select: { subscriptionStatus: true },
		});
		return user?.subscriptionStatus ?? null;
	}
}
