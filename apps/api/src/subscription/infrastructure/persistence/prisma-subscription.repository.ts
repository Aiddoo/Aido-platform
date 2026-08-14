import { ErrorCode } from "@aido/errors";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { Injectable } from "@nestjs/common";

import type * as PrismaModels from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import type {
	CreateSubscriptionData,
	SubscriptionRepositoryPort,
	SubscriptionUser,
	UpdateSubscriptionStatusData,
	UpdateUserSubscriptionStatusData,
} from "../../application/ports/subscription.repository.port";
import { Subscription } from "../../domain/entities/subscription.aggregate";

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

/**
 * 구독 저장소 Prisma 어댑터.
 *
 * RevenueCat 웹훅으로부터 수신한 구독 이벤트를 DB에 반영한다.
 *
 * 트랜잭션은 CLS로 전파된다 — TransactionHost.tx가 활성 트랜잭션 클라이언트를,
 * 활성 트랜잭션이 없으면 베이스 DatabaseService를 반환한다.
 */
@Injectable()
export class PrismaSubscriptionRepository implements SubscriptionRepositoryPort {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>,
	) {}

	/** 활성 트랜잭션(없으면 베이스 클라이언트) */
	private get client() {
		return this.txHost.tx;
	}

	/**
	 * RevenueCat 거래 ID로 구독 조회
	 */
	async findByRevenueCatId(revenueCatId: string): Promise<Subscription | null> {
		const row = await this.client.subscription.findUnique({
			where: { revenueCatId },
		});
		return row ? PrismaSubscriptionRepository.toDomain(row) : null;
	}

	/**
	 * RevenueCat appUserId로 사용자 조회
	 *
	 * revenueCatUserId 또는 id로 사용자를 찾는다. RevenueCat은 최초에 User.id를
	 * appUserId로 사용하고, 이후 alias가 설정되면 revenueCatUserId가 다를 수 있다.
	 */
	async findUserByAppUserId(appUserId: string): Promise<SubscriptionUser | null> {
		return this.client.user.findFirst({
			where: {
				OR: [{ revenueCatUserId: appUserId }, { id: appUserId }],
			},
			select: USER_SELECT,
		});
	}

	/**
	 * 구독 생성 (INITIAL_PURCHASE용)
	 */
	async create(data: CreateSubscriptionData): Promise<void> {
		await this.client.subscription.create({
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
	async updateStatus(revenueCatId: string, data: UpdateSubscriptionStatusData): Promise<void> {
		try {
			await this.client.subscription.update({
				where: { revenueCatId },
				data,
			});
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
				throw new ApplicationException(ErrorCode.SUBSCRIPTION_1604, {
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

	/** Prisma 행 → Subscription 애그리게잇 */
	private static toDomain(row: PrismaModels.Subscription): Subscription {
		return Subscription.reconstitute({
			id: row.id,
			userId: row.userId,
			revenueCatId: row.revenueCatId,
			productId: row.productId,
			status: row.status,
			startedAt: row.startedAt,
			expiresAt: row.expiresAt,
			cancelledAt: row.cancelledAt,
			lastProcessedEventId: row.lastProcessedEventId,
		});
	}
}
