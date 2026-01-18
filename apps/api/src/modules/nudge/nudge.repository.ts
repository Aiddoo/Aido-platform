import { Injectable } from "@nestjs/common";
import { DatabaseService } from "@/database/database.service";
import type { Nudge, Prisma } from "@/generated/prisma/client";

import type {
	CheckCooldownParams,
	CheckDailyLimitParams,
	FindNudgesParams,
	NudgeWithRelations,
	TransactionClient,
} from "./types";

// =============================================================================
// Repository
// =============================================================================

@Injectable()
export class NudgeRepository {
	constructor(private readonly database: DatabaseService) {}

	// Include 설정 (사용자 및 Todo 정보 포함)
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

	private readonly todoSelect = {
		id: true,
		title: true,
		completed: true,
	} as const;

	private readonly nudgeInclude = {
		sender: {
			select: this.userSelect,
		},
		receiver: {
			select: this.userSelect,
		},
		todo: {
			select: this.todoSelect,
		},
	} as const;

	// =========================================================================
	// 기본 CRUD
	// =========================================================================

	/**
	 * Nudge 생성
	 */
	async create(
		data: Prisma.NudgeCreateInput,
		tx?: TransactionClient,
	): Promise<Nudge> {
		const client = tx ?? this.database;
		return client.nudge.create({ data });
	}

	/**
	 * Nudge 생성 (관계 정보 포함 반환)
	 */
	async createWithRelations(
		data: Prisma.NudgeCreateInput,
		tx?: TransactionClient,
	): Promise<NudgeWithRelations> {
		const client = tx ?? this.database;
		return client.nudge.create({
			data,
			include: this.nudgeInclude,
		});
	}

	/**
	 * ID로 Nudge 조회
	 */
	async findById(id: number, tx?: TransactionClient): Promise<Nudge | null> {
		const client = tx ?? this.database;
		return client.nudge.findUnique({
			where: { id },
		});
	}

	/**
	 * ID로 Nudge 조회 (관계 정보 포함)
	 */
	async findByIdWithRelations(
		id: number,
		tx?: TransactionClient,
	): Promise<NudgeWithRelations | null> {
		const client = tx ?? this.database;
		return client.nudge.findUnique({
			where: { id },
			include: this.nudgeInclude,
		});
	}

	/**
	 * Nudge 읽음 처리
	 */
	async markAsRead(id: number, tx?: TransactionClient): Promise<Nudge> {
		const client = tx ?? this.database;
		return client.nudge.update({
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
			include: this.nudgeInclude,
			take: size + 1,
			...(cursor && {
				skip: 1,
				cursor: { id: cursor },
			}),
			orderBy: { createdAt: "desc" },
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
			include: this.nudgeInclude,
			take: size + 1,
			...(cursor && {
				skip: 1,
				cursor: { id: cursor },
			}),
			orderBy: { createdAt: "desc" },
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

		// 해당 날짜의 시작과 끝
		const startOfDay = new Date(date);
		startOfDay.setHours(0, 0, 0, 0);
		const endOfDay = new Date(date);
		endOfDay.setHours(23, 59, 59, 999);

		return this.database.nudge.count({
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

	// =========================================================================
	// 사용자 및 Todo 존재 확인
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

	/**
	 * Todo 존재 및 소유자 확인
	 */
	async findTodoWithOwner(
		todoId: number,
	): Promise<{ id: number; userId: string; title: string } | null> {
		return this.database.todo.findUnique({
			where: { id: todoId },
			select: {
				id: true,
				userId: true,
				title: true,
			},
		});
	}

	/**
	 * Todo 가시성 확인 (PUBLIC인지)
	 */
	async isTodoPublic(todoId: number): Promise<boolean> {
		const todo = await this.database.todo.findUnique({
			where: { id: todoId },
			select: { visibility: true },
		});
		return todo?.visibility === "PUBLIC";
	}
}
