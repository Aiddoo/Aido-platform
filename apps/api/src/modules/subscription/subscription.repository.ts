import { Injectable } from "@nestjs/common";

import type { TransactionClient } from "@/common/database";
import { DatabaseService } from "@/database/database.service";
import type { Subscription } from "@/generated/prisma/client";
import type { SubscriptionStatus } from "@/generated/prisma/enums";

/**
 * 사용자 조회 시 필요한 필드만 select
 */
const USER_SELECT = {
	id: true,
	email: true,
	subscriptionStatus: true,
	subscriptionExpiresAt: true,
	revenueCatUserId: true,
} as const;

export type SubscriptionUser = {
	id: string;
	email: string;
	subscriptionStatus: SubscriptionStatus;
	subscriptionExpiresAt: Date | null;
	revenueCatUserId: string | null;
};

/**
 * Subscription 생성 데이터
 */
export interface CreateSubscriptionData {
	userId: string;
	revenueCatId: string;
	productId: string;
	status: SubscriptionStatus;
	startedAt: Date;
	expiresAt: Date;
}

/**
 * Subscription 상태 업데이트 데이터
 */
export interface UpdateSubscriptionStatusData {
	status?: SubscriptionStatus;
	expiresAt?: Date;
	cancelledAt?: Date | null;
	productId?: string;
}

/**
 * User 구독 상태 동기화 데이터
 */
export interface UpdateUserSubscriptionStatusData {
	subscriptionStatus: SubscriptionStatus;
	subscriptionExpiresAt?: Date | null;
	revenueCatUserId?: string;
}

/**
 * 구독 Repository
 *
 * RevenueCat 웹훅으로부터 수신한 구독 이벤트를 DB에 반영합니다.
 * 모든 메서드는 `tx?` 파라미터를 받아 트랜잭션 내에서 사용할 수 있습니다.
 */
@Injectable()
export class SubscriptionRepository {
	constructor(private readonly database: DatabaseService) {}

	/**
	 * RevenueCat 거래 ID로 구독 조회
	 */
	async findByRevenueCatId(
		revenueCatId: string,
		tx?: TransactionClient,
	): Promise<Subscription | null> {
		const client = tx ?? this.database;
		return client.subscription.findUnique({
			where: { revenueCatId },
		});
	}

	/**
	 * 사용자의 활성 구독 조회
	 */
	async findActiveByUserId(
		userId: string,
		tx?: TransactionClient,
	): Promise<Subscription | null> {
		const client = tx ?? this.database;
		return client.subscription.findFirst({
			where: {
				userId,
				status: "ACTIVE",
				deletedAt: null,
			},
			orderBy: { expiresAt: "desc" },
		});
	}

	/**
	 * 구독 생성 (INITIAL_PURCHASE용)
	 */
	async create(
		data: CreateSubscriptionData,
		tx?: TransactionClient,
	): Promise<Subscription> {
		const client = tx ?? this.database;
		return client.subscription.create({
			data: {
				user: { connect: { id: data.userId } },
				revenueCatId: data.revenueCatId,
				productId: data.productId,
				status: data.status,
				startedAt: data.startedAt,
				expiresAt: data.expiresAt,
			},
		});
	}

	/**
	 * 구독 상태 업데이트
	 */
	async updateStatus(
		revenueCatId: string,
		data: UpdateSubscriptionStatusData,
		tx?: TransactionClient,
	): Promise<Subscription> {
		const client = tx ?? this.database;
		return client.subscription.update({
			where: { revenueCatId },
			data,
		});
	}

	/**
	 * User 테이블의 구독 상태 동기화
	 */
	async updateUserSubscriptionStatus(
		userId: string,
		data: UpdateUserSubscriptionStatusData,
		tx?: TransactionClient,
	): Promise<void> {
		const client = tx ?? this.database;
		await client.user.update({
			where: { id: userId },
			data: {
				subscriptionStatus: data.subscriptionStatus,
				...(data.subscriptionExpiresAt !== undefined && {
					subscriptionExpiresAt: data.subscriptionExpiresAt,
				}),
				...(data.revenueCatUserId !== undefined && {
					revenueCatUserId: data.revenueCatUserId,
				}),
			},
		});
	}

	/**
	 * RevenueCat appUserId로 사용자 조회
	 *
	 * revenueCatUserId 또는 id로 사용자를 찾습니다.
	 * RevenueCat은 최초에 User.id를 appUserId로 사용하고,
	 * 이후 alias가 설정되면 revenueCatUserId가 다를 수 있습니다.
	 */
	async findUserByAppUserId(
		appUserId: string,
		tx?: TransactionClient,
	): Promise<SubscriptionUser | null> {
		const client = tx ?? this.database;
		return client.user.findFirst({
			where: {
				OR: [{ revenueCatUserId: appUserId }, { id: appUserId }],
			},
			select: USER_SELECT,
		});
	}
}
