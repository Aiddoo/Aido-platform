import { NUDGE_LIMITS, REMIND_NUDGE_LIMITS } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { FollowService } from "@/follow/follow.service";
import { NotificationQueueService } from "@/notification/queue";
import {
	EntitlementService,
	Feature,
} from "@/shared/application/entitlement/entitlement.service";
import { BusinessExceptions } from "@/shared/application/exceptions/business-exception.service";
import type { CursorPaginatedResponse } from "@/shared/application/pagination";
import { PaginationService } from "@/shared/application/pagination";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { isSameDay } from "@/shared/domain/date/utils/compare";
import { calculateCooldown } from "@/shared/domain/date/utils/cooldown";
import { now } from "@/shared/domain/date/utils/core";
import {
	startOfDayInTimezone,
	todayInTimezone,
} from "@/shared/domain/date/utils/timezone";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import { NudgeRepository } from "./nudge.repository";
import type {
	NudgeCooldownInfo,
	NudgeLimitInfo,
	NudgeWithRelations,
	ReminderNudgeWithRelations,
	SendNudgeParams,
	SendRemindNudgeParams,
} from "./types";

@Injectable()
export class NudgeService {
	readonly #logger = new Logger(NudgeService.name);

	constructor(
		private readonly nudgeRepository: NudgeRepository,
		private readonly followService: FollowService,
		private readonly paginationService: PaginationService,
		private readonly notificationQueueService: NotificationQueueService,
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
		private readonly entitlementService: EntitlementService,
	) {}

	// =========================================================================
	// 공통 검증 (private)
	// =========================================================================

	#validateNotSelf(senderId: string, receiverId: string): void {
		if (senderId === receiverId) {
			throw BusinessExceptions.cannotNudgeSelf();
		}
	}

	async #validateFriendship(
		senderId: string,
		receiverId: string,
	): Promise<void> {
		const isFriend = await this.followService.isMutualFriend(
			senderId,
			receiverId,
		);
		if (!isFriend) {
			throw BusinessExceptions.nudgeNotFriend(receiverId);
		}
	}

	// =========================================================================
	// 콕 찌르기 (기존)
	// =========================================================================

	/**
	 * 콕 찌르기 보내기
	 *
	 * 1. 자기 자신 체크
	 * 2. 친구 관계 확인
	 * 3. Todo 존재 및 소유자 확인
	 * 3.5. 오늘의 할 일인지 체크
	 * 4. 일일 제한 체크
	 * 5. 쿨다운 체크
	 * 6. Nudge 생성
	 * 7. 이벤트 발행 (트랜잭션 성공 후)
	 *
	 * @note 트랜잭션 사용: Rate Limiting의 TOCTOU 동시성 문제 방지
	 */
	async sendNudge(
		params: SendNudgeParams,
		tz: string = "UTC",
	): Promise<NudgeWithRelations> {
		const { senderId, receiverId, todoId, message } = params;

		this.#validateNotSelf(senderId, receiverId);
		await this.#validateFriendship(senderId, receiverId);

		const nudge = await this.uow.run(async () => {
			// 3. Todo 존재 및 소유자 확인
			const todo = await this.nudgeRepository.findTodoForNudge(todoId);

			if (!todo) {
				throw BusinessExceptions.todoNotFound(todoId);
			}

			if (todo.userId !== receiverId) {
				throw BusinessExceptions.todoNotFound(todoId);
			}

			// 3.5. 공개 Todo + 오늘의 할 일 체크
			if (todo.visibility !== "PUBLIC") {
				throw BusinessExceptions.todoNotFound(todoId);
			}

			const today = todayInTimezone(tz);
			const isTodayTodo = todo.endDate
				? todo.startDate <= today && today <= todo.endDate
				: isSameDay(todo.startDate, today);

			if (!isTodayTodo) {
				throw BusinessExceptions.nudgeTodoNotToday(todoId);
			}

			// 4. 일일 제한 체크
			// getFeatureLimitInTx는 명시적 tx 클라이언트를 받으므로 CLS의 활성 트랜잭션을 전달
			const entitlement = await this.entitlementService.getFeatureLimitInTx(
				this.txHost.tx,
				senderId,
				Feature.NUDGE,
			);

			const todayStart = startOfDayInTimezone(now(), tz);
			const used = await this.nudgeRepository.countTodayNudges({
				senderId,
				date: todayStart,
			});

			this.entitlementService.enforceLimit(entitlement, used, (_used, limit) =>
				BusinessExceptions.nudgeDailyLimitExceeded(limit),
			);

			// 5. 쿨다운 체크
			const lastNudge = await this.nudgeRepository.findLastNudgeForTodo({
				senderId,
				todoId,
			});

			if (lastNudge) {
				const cooldown = calculateCooldown(
					lastNudge.createdAt,
					NUDGE_LIMITS.COOLDOWN_HOURS,
				);
				if (cooldown.isActive) {
					throw BusinessExceptions.nudgeCooldownActive(
						receiverId,
						cooldown.remainingSeconds,
					);
				}
			}

			// 6. Nudge 생성
			return this.nudgeRepository.createNudge({
				senderId,
				receiverId,
				todoId,
				message,
			});
		});

		this.#logger.log(
			`Nudge sent: senderId=${senderId}, receiverId=${receiverId}, todoId=${todoId}`,
		);

		const senderName = nudge.sender.profile?.name ?? nudge.sender.userTag;
		this.notificationQueueService.enqueueNudgeSent({
			nudgeId: nudge.id,
			senderId,
			receiverId,
			senderName,
			todoId,
			todoTitle: nudge.todo.title,
			message,
		});

		return nudge;
	}

	// =========================================================================
	// 리마인드 콕 찌르기 (할일 만들기 독촉)
	// =========================================================================

	/**
	 * 리마인드 콕 찌르기 보내기
	 *
	 * 친구가 오늘 할일을 만들지 않았을 때 독촉하는 기능.
	 * - 일일 제한 없음 (쿨다운만 적용)
	 * - 같은 친구에게 1시간 쿨다운
	 *
	 * @note 트랜잭션 사용: 쿨다운 TOCTOU 동시성 문제 방지
	 */
	async sendRemindNudge(
		params: SendRemindNudgeParams,
		tz: string = "UTC",
	): Promise<ReminderNudgeWithRelations> {
		const { senderId, receiverId, message } = params;

		// 1. 자기 자신 체크
		this.#validateNotSelf(senderId, receiverId);

		// 2. 친구 관계 확인
		await this.#validateFriendship(senderId, receiverId);

		const remindNudge = await this.uow.run(async () => {
			// 3. 친구의 오늘 할일 존재 여부 체크
			const today = todayInTimezone(tz);
			const todayTodoCount = await this.nudgeRepository.countTodayTodos(
				receiverId,
				today,
			);

			if (todayTodoCount > 0) {
				throw BusinessExceptions.remindNudgeFriendHasTodos(receiverId);
			}

			// 4. 쿨다운 체크 (같은 친구에게 1시간)
			const lastRemind = await this.nudgeRepository.findLastRemindNudge(
				senderId,
				receiverId,
			);

			if (lastRemind) {
				const cooldown = calculateCooldown(
					lastRemind.createdAt,
					REMIND_NUDGE_LIMITS.COOLDOWN_HOURS,
				);
				if (cooldown.isActive) {
					throw BusinessExceptions.remindNudgeCooldownActive(
						receiverId,
						cooldown.remainingSeconds,
					);
				}
			}

			// 5. ReminderNudge 생성
			return this.nudgeRepository.createRemindNudge({
				senderId,
				receiverId,
				message,
			});
		});

		this.#logger.log(
			`Remind nudge sent: senderId=${senderId}, receiverId=${receiverId}`,
		);

		// 6. 알림 발송 (트랜잭션 커밋 후, todoId/todoTitle 없이)
		const senderName =
			remindNudge.sender.profile?.name ?? remindNudge.sender.userTag;
		this.notificationQueueService.enqueueNudgeSent({
			nudgeId: remindNudge.id,
			senderId,
			receiverId,
			senderName,
			message,
		});

		return remindNudge;
	}

	/**
	 * 리마인드 콕 찌르기 쿨다운 정보 조회
	 */
	async getRemindCooldownInfo(
		senderId: string,
		receiverId: string,
	): Promise<NudgeCooldownInfo> {
		const lastRemind = await this.nudgeRepository.findLastRemindNudge(
			senderId,
			receiverId,
		);

		return this.#calculateCooldownInfo(
			lastRemind?.createdAt,
			REMIND_NUDGE_LIMITS.COOLDOWN_HOURS,
		);
	}

	// =========================================================================
	// 기존 조회/관리 메서드
	// =========================================================================

	/**
	 * 받은 콕 찌르기 목록 조회
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

		this.#logger.debug(
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
	 * 보낸 콕 찌르기 목록 조회
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

		this.#logger.debug(
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

	/**
	 * 일일 콕 찌르기 제한 정보 조회
	 */
	async getLimitInfo(
		userId: string,
		tz: string = "UTC",
	): Promise<NudgeLimitInfo> {
		const { dailyLimit } = await this.entitlementService.getFeatureLimit(
			userId,
			Feature.NUDGE,
		);

		const today = startOfDayInTimezone(now(), tz);
		const used = await this.nudgeRepository.countTodayNudges({
			senderId: userId,
			date: today,
		});

		return {
			dailyLimit,
			used,
			remaining: this.entitlementService.calculateRemaining(dailyLimit, used),
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

		return this.#calculateCooldownInfo(lastNudge?.createdAt);
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

		return this.#calculateCooldownInfo(lastNudge?.createdAt);
	}

	/**
	 * 콕 찌르기 읽음 처리
	 */
	async markAsRead(userId: string, nudgeId: number): Promise<void> {
		const nudge = await this.nudgeRepository.findById(nudgeId);

		if (!nudge) {
			throw BusinessExceptions.nudgeNotFound(nudgeId);
		}

		if (nudge.receiverId !== userId) {
			throw BusinessExceptions.nudgeNotFound(nudgeId);
		}

		if (nudge.readAt) {
			return;
		}

		await this.nudgeRepository.markAsRead(nudgeId);

		this.#logger.debug(`Nudge marked as read: id=${nudgeId}`);
	}

	/**
	 * 받은 Nudge 총 개수
	 */
	async countReceivedNudges(userId: string): Promise<number> {
		return this.nudgeRepository.countReceived(userId);
	}

	/**
	 * 보낸 Nudge 총 개수
	 */
	async countSentNudges(userId: string): Promise<number> {
		return this.nudgeRepository.countSent(userId);
	}

	/**
	 * 읽지 않은 받은 Nudge 개수
	 */
	async countUnreadReceivedNudges(userId: string): Promise<number> {
		return this.nudgeRepository.countUnreadReceived(userId);
	}

	// =========================================================================
	// Private helpers
	// =========================================================================

	/**
	 * 쿨다운 정보 계산
	 */
	#calculateCooldownInfo(
		lastNudgeTime?: Date | null,
		cooldownHours: number = NUDGE_LIMITS.COOLDOWN_HOURS,
	): NudgeCooldownInfo {
		const { isActive, remainingSeconds, endsAt } = calculateCooldown(
			lastNudgeTime ?? null,
			cooldownHours,
		);
		return { isActive, remainingSeconds, cooldownEndsAt: endsAt };
	}
}
