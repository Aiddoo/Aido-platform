import { NUDGE_LIMITS, SUBSCRIPTION_NUDGE_LIMITS } from "@aido/validators";
import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import type { CursorPaginatedResponse } from "@/common/pagination/interfaces/pagination.interface";
import { PaginationService } from "@/common/pagination/services/pagination.service";
import { DatabaseService } from "@/database/database.service";
import { FollowService } from "@/modules/follow/follow.service";
import {
	NotificationEvents,
	type NudgeSentEventPayload,
} from "@/modules/notification/events";

import { NudgeRepository } from "./nudge.repository";
import type {
	NudgeCooldownInfo,
	NudgeLimitInfo,
	NudgeWithRelations,
	SendNudgeParams,
} from "./types";

// =============================================================================
// Service
// =============================================================================

/**
 * Nudge 서비스
 *
 * - 독촉 보내기 (친구 확인, 일일 제한, 쿨다운 체크)
 * - 받은/보낸 독촉 목록 조회
 * - 제한 및 쿨다운 정보 조회
 */
@Injectable()
export class NudgeService {
	private readonly logger = new Logger(NudgeService.name);

	constructor(
		private readonly nudgeRepository: NudgeRepository,
		private readonly followService: FollowService,
		private readonly paginationService: PaginationService,
		private readonly eventEmitter: EventEmitter2,
		private readonly database: DatabaseService,
	) {}

	// =========================================================================
	// 독촉 보내기
	// =========================================================================

	/**
	 * 독촉 보내기
	 *
	 * 1. 자기 자신 체크
	 * 2. 친구 관계 확인
	 * 3. Todo 존재 및 소유자 확인
	 * 4. 일일 제한 체크
	 * 5. 쿨다운 체크
	 * 6. Nudge 생성
	 * 7. 이벤트 발행 (트랜잭션 성공 후)
	 *
	 * @note 트랜잭션 사용: Rate Limiting의 TOCTOU 동시성 문제 방지
	 */
	async sendNudge(params: SendNudgeParams): Promise<NudgeWithRelations> {
		const { senderId, receiverId, todoId, message } = params;

		// 트랜잭션으로 감싸서 check-and-create를 atomic하게 수행
		const nudge = await this.database.$transaction(async (tx) => {
			// 1. 자기 자신 체크
			if (senderId === receiverId) {
				throw BusinessExceptions.cannotNudgeSelf();
			}

			// 2. 친구 관계 확인
			const isFriend = await this.followService.isMutualFriend(
				senderId,
				receiverId,
			);
			if (!isFriend) {
				throw BusinessExceptions.nudgeNotFriend(receiverId);
			}

			// 3. Todo 존재 및 소유자 확인
			const todo = await tx.todo.findUnique({
				where: { id: todoId },
				select: { id: true, userId: true, title: true },
			});
			if (!todo) {
				throw BusinessExceptions.todoNotFound(todoId);
			}

			// Todo가 receiver의 것인지 확인
			if (todo.userId !== receiverId) {
				throw BusinessExceptions.todoNotFound(todoId);
			}

			// 4. 일일 제한 체크 (트랜잭션 내에서 실시간 조회)
			const subscriptionStatus = await tx.user.findUnique({
				where: { id: senderId },
				select: { subscriptionStatus: true },
			});

			const status = subscriptionStatus?.subscriptionStatus ?? "FREE";
			const limitKey = status as keyof typeof SUBSCRIPTION_NUDGE_LIMITS;
			const dailyLimit =
				limitKey in SUBSCRIPTION_NUDGE_LIMITS
					? SUBSCRIPTION_NUDGE_LIMITS[limitKey]
					: NUDGE_LIMITS.FREE_DAILY_LIMIT;

			const today = new Date();
			const startOfDay = new Date(
				today.getFullYear(),
				today.getMonth(),
				today.getDate(),
			);
			const used = await tx.nudge.count({
				where: {
					senderId,
					createdAt: { gte: startOfDay },
				},
			});

			const remaining =
				dailyLimit === null ? null : Math.max(0, dailyLimit - used);

			if (remaining !== null && remaining <= 0) {
				throw BusinessExceptions.nudgeDailyLimitExceeded(dailyLimit as number);
			}

			// 5. 쿨다운 체크 (트랜잭션 내에서 실시간 조회)
			const lastNudge = await tx.nudge.findFirst({
				where: {
					senderId,
					todoId,
				},
				orderBy: { createdAt: "desc" },
			});

			if (lastNudge) {
				const cooldownMs = NUDGE_LIMITS.COOLDOWN_HOURS * 60 * 60 * 1000;
				const canNudgeAt = new Date(lastNudge.createdAt.getTime() + cooldownMs);
				const now = new Date();

				if (now < canNudgeAt) {
					const remainingMs = canNudgeAt.getTime() - now.getTime();
					const remainingSeconds = Math.ceil(remainingMs / 1000);
					throw BusinessExceptions.nudgeCooldownActive(
						receiverId,
						remainingSeconds,
					);
				}
			}

			// 6. Nudge 생성
			const newNudge = await tx.nudge.create({
				data: {
					sender: { connect: { id: senderId } },
					receiver: { connect: { id: receiverId } },
					todo: { connect: { id: todoId } },
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
					todo: {
						select: {
							id: true,
							title: true,
							completed: true,
						},
					},
				},
			});

			this.logger.log(
				`Nudge sent: senderId=${senderId}, receiverId=${receiverId}, todoId=${todoId}`,
			);

			return newNudge;
		});

		// 7. 이벤트 발행 (트랜잭션 성공 후 발행)
		const senderName = nudge.sender.profile?.name ?? nudge.sender.userTag;
		this.eventEmitter.emit(NotificationEvents.NUDGE_SENT, {
			nudgeId: nudge.id,
			senderId,
			receiverId,
			senderName,
			todoId,
			todoTitle: nudge.todo.title,
		} satisfies NudgeSentEventPayload);

		return nudge;
	}

	// =========================================================================
	// 목록 조회
	// =========================================================================

	/**
	 * 받은 독촉 목록 조회
	 */
	async getReceivedNudges(params: {
		userId: string;
		cursor?: number;
		size?: number;
	}): Promise<CursorPaginatedResponse<NudgeWithRelations, number>> {
		const { cursor, size } =
			this.paginationService.normalizeCursorPagination<number>({
				cursor: params.cursor,
				size: params.size,
			});

		const nudges = await this.nudgeRepository.findReceivedNudges({
			userId: params.userId,
			cursor,
			size,
		});

		this.logger.debug(
			`Received nudges listed: ${nudges.length} items for user: ${params.userId}`,
		);

		return this.paginationService.createCursorPaginatedResponse<
			NudgeWithRelations,
			number
		>({
			items: nudges,
			size,
		});
	}

	/**
	 * 보낸 독촉 목록 조회
	 */
	async getSentNudges(params: {
		userId: string;
		cursor?: number;
		size?: number;
	}): Promise<CursorPaginatedResponse<NudgeWithRelations, number>> {
		const { cursor, size } =
			this.paginationService.normalizeCursorPagination<number>({
				cursor: params.cursor,
				size: params.size,
			});

		const nudges = await this.nudgeRepository.findSentNudges({
			userId: params.userId,
			cursor,
			size,
		});

		this.logger.debug(
			`Sent nudges listed: ${nudges.length} items for user: ${params.userId}`,
		);

		return this.paginationService.createCursorPaginatedResponse<
			NudgeWithRelations,
			number
		>({
			items: nudges,
			size,
		});
	}

	// =========================================================================
	// 제한 및 쿨다운 정보
	// =========================================================================

	/**
	 * 일일 독촉 제한 정보 조회
	 */
	async getLimitInfo(userId: string): Promise<NudgeLimitInfo> {
		// 구독 상태 조회
		const subscriptionStatus =
			await this.nudgeRepository.getUserSubscriptionStatus(userId);

		// 구독 상태에 따른 제한
		const status = subscriptionStatus ?? "FREE";
		const limitKey = status as keyof typeof SUBSCRIPTION_NUDGE_LIMITS;
		// ACTIVE 구독자는 null(무제한)이므로 undefined만 체크
		const dailyLimit =
			limitKey in SUBSCRIPTION_NUDGE_LIMITS
				? SUBSCRIPTION_NUDGE_LIMITS[limitKey]
				: NUDGE_LIMITS.FREE_DAILY_LIMIT;

		// 오늘 사용량 조회
		const today = new Date();
		const used = await this.nudgeRepository.countTodayNudges({
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
	 * 특정 Todo에 대한 쿨다운 정보 조회
	 */
	async getCooldownInfoForTodo(
		senderId: string,
		todoId: number,
	): Promise<NudgeCooldownInfo> {
		const lastNudge = await this.nudgeRepository.findLastNudgeForTodo({
			senderId,
			todoId,
		});

		return this.calculateCooldownInfo(lastNudge?.createdAt);
	}

	/**
	 * 특정 사용자에 대한 쿨다운 정보 조회
	 */
	async getCooldownInfoForUser(
		senderId: string,
		receiverId: string,
	): Promise<NudgeCooldownInfo> {
		const lastNudge = await this.nudgeRepository.findLastNudgeToUser(
			senderId,
			receiverId,
		);

		return this.calculateCooldownInfo(lastNudge?.createdAt);
	}

	// =========================================================================
	// 읽음 처리
	// =========================================================================

	/**
	 * 독촉 읽음 처리
	 */
	async markAsRead(userId: string, nudgeId: number): Promise<void> {
		const nudge = await this.nudgeRepository.findById(nudgeId);

		if (!nudge) {
			throw BusinessExceptions.nudgeNotFound(nudgeId);
		}

		// 수신자만 읽음 처리 가능
		if (nudge.receiverId !== userId) {
			throw BusinessExceptions.nudgeNotFound(nudgeId);
		}

		// 이미 읽은 경우 무시
		if (nudge.readAt) {
			return;
		}

		await this.nudgeRepository.markAsRead(nudgeId);

		this.logger.debug(`Nudge marked as read: id=${nudgeId}`);
	}

	// =========================================================================
	// Private Methods
	// =========================================================================

	/**
	 * 쿨다운 정보 계산
	 */
	private calculateCooldownInfo(
		lastNudgeTime?: Date | null,
	): NudgeCooldownInfo {
		if (!lastNudgeTime) {
			return {
				isActive: false,
				remainingSeconds: 0,
				canNudgeAt: null,
			};
		}

		const cooldownMs = NUDGE_LIMITS.COOLDOWN_HOURS * 60 * 60 * 1000;
		const canNudgeAt = new Date(lastNudgeTime.getTime() + cooldownMs);
		const now = new Date();

		if (now >= canNudgeAt) {
			return {
				isActive: false,
				remainingSeconds: 0,
				canNudgeAt: null,
			};
		}

		const remainingMs = canNudgeAt.getTime() - now.getTime();
		const remainingSeconds = Math.ceil(remainingMs / 1000);

		return {
			isActive: true,
			remainingSeconds,
			canNudgeAt,
		};
	}
}
