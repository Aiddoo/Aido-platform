import { CHEER_LIMITS, SUBSCRIPTION_CHEER_LIMITS } from "@aido/validators";
import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CacheService } from "@/common/cache/cache.service";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import type { CursorPaginatedResponse } from "@/common/pagination/interfaces/pagination.interface";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import { DatabaseService } from "@/database/database.service";
import { FollowService } from "@/modules/follow/follow.service";
import {
	type CheerSentEventPayload,
	NotificationEvents,
} from "@/modules/notification/events";

import { CheerRepository } from "./cheer.repository";
import type {
	CheerCooldownInfo,
	CheerLimitInfo,
	CheerWithRelations,
	SendCheerParams,
} from "./types";

// =============================================================================
// Service
// =============================================================================

/**
 * Cheer 서비스
 *
 * - 응원 보내기 (친구 확인, 일일 제한, 쿨다운 체크)
 * - 받은/보낸 응원 목록 조회
 * - 제한 및 쿨다운 정보 조회
 */
@Injectable()
export class CheerService {
	private readonly logger = new Logger(CheerService.name);

	constructor(
		private readonly cheerRepository: CheerRepository,
		private readonly followService: FollowService,
		private readonly paginationService: PaginationService,
		private readonly eventEmitter: EventEmitter2,
		private readonly database: DatabaseService,
		private readonly cacheService: CacheService,
	) {}

	// =========================================================================
	// 응원 보내기
	// =========================================================================

	/**
	 * 응원 보내기
	 *
	 * 1. 자기 자신 체크
	 * 2. 친구 관계 확인
	 * 3. 일일 제한 체크 (트랜잭션 내)
	 * 4. 쿨다운 체크 (트랜잭션 내)
	 * 5. Cheer 생성 (트랜잭션 내)
	 * 6. 이벤트 발행
	 *
	 * @note 트랜잭션으로 감싸서 TOCTOU 경합 조건을 방지합니다.
	 */
	async sendCheer(params: SendCheerParams): Promise<CheerWithRelations> {
		const { senderId, receiverId, message } = params;

		// 1. 자기 자신 체크
		if (senderId === receiverId) {
			throw BusinessExceptions.cannotCheerSelf();
		}

		// 2. 친구 관계 확인
		const isFriend = await this.followService.isMutualFriend(
			senderId,
			receiverId,
		);
		if (!isFriend) {
			throw BusinessExceptions.cheerNotFriend(receiverId);
		}

		// 트랜잭션으로 감싸서 check-and-create를 atomic하게 수행
		const cheer = await this.database.$transaction(async (tx) => {
			// 3. 일일 제한 체크 (트랜잭션 내에서 실시간 조회)
			const today = new Date();
			const startOfDay = new Date(
				today.getFullYear(),
				today.getMonth(),
				today.getDate(),
			);

			const subscriptionStatus = await tx.user.findUnique({
				where: { id: senderId },
				select: { subscriptionStatus: true },
			});

			const status = subscriptionStatus?.subscriptionStatus ?? "FREE";
			const limitKey = status as keyof typeof SUBSCRIPTION_CHEER_LIMITS;
			const dailyLimit =
				limitKey in SUBSCRIPTION_CHEER_LIMITS
					? SUBSCRIPTION_CHEER_LIMITS[limitKey]
					: CHEER_LIMITS.FREE_DAILY_LIMIT;

			const used = await tx.cheer.count({
				where: {
					senderId,
					createdAt: {
						gte: startOfDay,
					},
				},
			});

			if (dailyLimit !== null && used >= dailyLimit) {
				throw BusinessExceptions.cheerDailyLimitExceeded(dailyLimit);
			}

			// 4. 쿨다운 체크 (트랜잭션 내에서 실시간 조회)
			const lastCheer = await tx.cheer.findFirst({
				where: {
					senderId,
					receiverId,
				},
				orderBy: {
					createdAt: "desc",
				},
			});

			if (lastCheer) {
				const cooldownMs = CHEER_LIMITS.COOLDOWN_HOURS * 60 * 60 * 1000;
				const canCheerAt = new Date(lastCheer.createdAt.getTime() + cooldownMs);
				const now = new Date();

				if (now < canCheerAt) {
					const remainingMs = canCheerAt.getTime() - now.getTime();
					const remainingSeconds = Math.ceil(remainingMs / 1000);
					throw BusinessExceptions.cheerCooldownActive(
						receiverId,
						remainingSeconds,
					);
				}
			}

			// 5. Cheer 생성 (트랜잭션 내)
			const newCheer = await tx.cheer.create({
				data: {
					sender: { connect: { id: senderId } },
					receiver: { connect: { id: receiverId } },
					message,
				},
				include: {
					sender: {
						select: {
							id: true,
							userTag: true,
							profile: {
								select: {
									name: true,
									profileImage: true,
								},
							},
						},
					},
					receiver: {
						select: {
							id: true,
							userTag: true,
							profile: {
								select: {
									name: true,
									profileImage: true,
								},
							},
						},
					},
				},
			});

			return newCheer;
		});

		this.logger.log(
			`Cheer sent: senderId=${senderId}, receiverId=${receiverId}`,
		);

		// 6. 이벤트 발행 (트랜잭션 외부)
		const senderName = cheer.sender.profile?.name ?? "알 수 없음";
		this.eventEmitter.emit(NotificationEvents.CHEER_SENT, {
			cheerId: cheer.id,
			senderId,
			receiverId,
			senderName,
			message,
		} satisfies CheerSentEventPayload);

		return cheer;
	}

	// =========================================================================
	// 목록 조회
	// =========================================================================

	/**
	 * 받은 응원 목록 조회
	 */
	async getReceivedCheers(params: {
		userId: string;
		cursor?: number;
		size?: number;
	}): Promise<CursorPaginatedResponse<CheerWithRelations, number>> {
		const { cursor, size } =
			this.paginationService.normalizeCursorPagination<number>({
				cursor: params.cursor,
				size: params.size,
			});

		const cheers = await this.cheerRepository.findReceivedCheers({
			userId: params.userId,
			cursor,
			size,
		});

		this.logger.debug(
			`Received cheers listed: ${cheers.length} items for user: ${params.userId}`,
		);

		return this.paginationService.createCursorPaginatedResponse<
			CheerWithRelations,
			number
		>({
			items: cheers,
			size,
		});
	}

	/**
	 * 보낸 응원 목록 조회
	 */
	async getSentCheers(params: {
		userId: string;
		cursor?: number;
		size?: number;
	}): Promise<CursorPaginatedResponse<CheerWithRelations, number>> {
		const { cursor, size } =
			this.paginationService.normalizeCursorPagination<number>({
				cursor: params.cursor,
				size: params.size,
			});

		const cheers = await this.cheerRepository.findSentCheers({
			userId: params.userId,
			cursor,
			size,
		});

		this.logger.debug(
			`Sent cheers listed: ${cheers.length} items for user: ${params.userId}`,
		);

		return this.paginationService.createCursorPaginatedResponse<
			CheerWithRelations,
			number
		>({
			items: cheers,
			size,
		});
	}

	// =========================================================================
	// 제한 및 쿨다운 정보
	// =========================================================================

	/**
	 * 일일 응원 제한 정보 조회
	 */
	async getLimitInfo(userId: string): Promise<CheerLimitInfo> {
		// 구독 상태 조회 (캐시 우선)
		let subscriptionStatus: "FREE" | "ACTIVE" | "EXPIRED" | "CANCELLED" | null;

		const cachedSubscription = await this.cacheService.getSubscription(userId);
		if (cachedSubscription !== undefined) {
			subscriptionStatus = cachedSubscription.status;
		} else {
			subscriptionStatus =
				await this.cheerRepository.getUserSubscriptionStatus(userId);
			await this.cacheService.setSubscription(userId, {
				status: subscriptionStatus,
			});
		}

		// 구독 상태에 따른 제한
		const status = subscriptionStatus ?? "FREE";
		const limitKey = status as keyof typeof SUBSCRIPTION_CHEER_LIMITS;
		// ACTIVE 구독자는 null(무제한)이므로 undefined만 체크
		const dailyLimit =
			limitKey in SUBSCRIPTION_CHEER_LIMITS
				? SUBSCRIPTION_CHEER_LIMITS[limitKey]
				: CHEER_LIMITS.FREE_DAILY_LIMIT;

		// 오늘 사용량 조회
		const today = new Date();
		const used = await this.cheerRepository.countTodayCheers({
			senderId: userId,
			date: today,
		});

		// 남은 횟수 계산
		const remaining =
			dailyLimit === null ? null : Math.max(0, dailyLimit - used);

		return {
			dailyLimit,
			used,
			remaining,
		};
	}

	/**
	 * 특정 사용자에 대한 쿨다운 정보 조회
	 */
	async getCooldownInfoForUser(
		senderId: string,
		receiverId: string,
	): Promise<CheerCooldownInfo> {
		const lastCheer = await this.cheerRepository.findLastCheerToUser({
			senderId,
			receiverId,
		});

		return this.calculateCooldownInfo(lastCheer?.createdAt);
	}

	// =========================================================================
	// 읽음 처리
	// =========================================================================

	/**
	 * 응원 읽음 처리
	 */
	async markAsRead(userId: string, cheerId: number): Promise<void> {
		const cheer = await this.cheerRepository.findById(cheerId);

		if (!cheer) {
			throw BusinessExceptions.cheerNotFound(cheerId);
		}

		// 수신자만 읽음 처리 가능
		if (cheer.receiverId !== userId) {
			throw BusinessExceptions.cheerNotFound(cheerId);
		}

		// 이미 읽은 경우 무시
		if (cheer.readAt) {
			return;
		}

		await this.cheerRepository.markAsRead(cheerId);

		this.logger.debug(`Cheer marked as read: id=${cheerId}`);
	}

	/**
	 * 여러 응원 읽음 처리
	 */
	async markManyAsRead(userId: string, cheerIds: number[]): Promise<number> {
		const count = await this.cheerRepository.markManyAsRead(cheerIds, userId);

		this.logger.debug(`${count} cheers marked as read for user: ${userId}`);

		return count;
	}

	// =========================================================================
	// Private Methods
	// =========================================================================

	/**
	 * 쿨다운 정보 계산
	 */
	private calculateCooldownInfo(
		lastCheerTime?: Date | null,
	): CheerCooldownInfo {
		if (!lastCheerTime) {
			return {
				isActive: false,
				remainingSeconds: 0,
				canCheerAt: null,
			};
		}

		const cooldownMs = CHEER_LIMITS.COOLDOWN_HOURS * 60 * 60 * 1000;
		const canCheerAt = new Date(lastCheerTime.getTime() + cooldownMs);
		const now = new Date();

		if (now >= canCheerAt) {
			return {
				isActive: false,
				remainingSeconds: 0,
				canCheerAt: null,
			};
		}

		const remainingMs = canCheerAt.getTime() - now.getTime();
		const remainingSeconds = Math.ceil(remainingMs / 1000);

		return {
			isActive: true,
			remainingSeconds,
			canCheerAt,
		};
	}
}
