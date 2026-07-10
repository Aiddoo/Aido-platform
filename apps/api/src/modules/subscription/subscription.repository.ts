import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";

import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import type { DatabaseService } from "@/database/database.service";
import { Prisma, type Subscription } from "@/generated/prisma/client";
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
	profile: { select: { name: true } },
} as const;

export type SubscriptionUser = {
	id: string;
	email: string;
	subscriptionStatus: SubscriptionStatus;
	subscriptionExpiresAt: Date | null;
	revenueCatUserId: string | null;
	profile: { name: string | null } | null;
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
	lastProcessedEventId?: string;
}

/**
 * Subscription 상태 업데이트 데이터
 */
export interface UpdateSubscriptionStatusData {
	status?: SubscriptionStatus;
	expiresAt?: Date;
	cancelledAt?: Date | null;
	productId?: string;
	lastProcessedEventId?: string;
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
 *
 * 트랜잭션은 CLS로 전파됩니다 — TransactionHost.tx가 활성 트랜잭션 클라이언트를,
 * 활성 트랜잭션이 없으면 베이스 DatabaseService를 반환합니다(기존 `tx ?? this.database`와 등가).
 */
@Injectable()
export class SubscriptionRepository {
	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
	) {}

	/** 활성 트랜잭션(없으면 베이스 클라이언트) */
	private get client() {
		return this.txHost.tx;
	}

	/**
	 * RevenueCat 거래 ID로 구독 조회
	 */
	async findByRevenueCatId(revenueCatId: string): Promise<Subscription | null> {
		return this.client.subscription.findUnique({
			where: { revenueCatId },
		});
	}

	/**
	 * 사용자의 활성 구독 조회
	 */
	async findActiveByUserId(userId: string): Promise<Subscription | null> {
		return this.client.subscription.findFirst({
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
	async create(data: CreateSubscriptionData): Promise<Subscription> {
		return this.client.subscription.create({
			data: {
				user: { connect: { id: data.userId } },
				revenueCatId: data.revenueCatId,
				productId: data.productId,
				status: data.status,
				startedAt: data.startedAt,
				expiresAt: data.expiresAt,
				...(data.lastProcessedEventId && {
					lastProcessedEventId: data.lastProcessedEventId,
				}),
			},
		});
	}

	/**
	 * 구독 상태 업데이트
	 */
	async updateStatus(
		revenueCatId: string,
		data: UpdateSubscriptionStatusData,
	): Promise<Subscription> {
		try {
			return await this.client.subscription.update({
				where: { revenueCatId },
				data,
			});
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw BusinessExceptions.webhookProcessingFailed({
					reason: `Subscription not found: ${revenueCatId}`,
				});
			}
			throw error;
		}
	}

	/**
	 * User 테이블의 구독 상태 동기화
	 */
	async updateUserSubscriptionStatus(
		userId: string,
		data: UpdateUserSubscriptionStatusData,
	): Promise<void> {
		await this.client.user.update({
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
	): Promise<SubscriptionUser | null> {
		return this.client.user.findFirst({
			where: {
				OR: [{ revenueCatUserId: appUserId }, { id: appUserId }],
			},
			select: USER_SELECT,
		});
	}
}
