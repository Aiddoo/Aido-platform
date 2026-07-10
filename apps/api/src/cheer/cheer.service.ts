import { CHEER_LIMITS } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { FollowFacade } from "@/follow";
import { NotificationQueueService } from "@/notification/queue";
import {
	EntitlementService,
	Feature,
} from "@/shared/application/entitlement/entitlement.service";
import { BusinessExceptions } from "@/shared/application/exceptions/business-exception.service";
import type { CursorPaginatedResponse } from "@/shared/application/pagination";
import { PaginationService } from "@/shared/application/pagination";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { calculateCooldown } from "@/shared/domain/date/utils/cooldown";
import { now } from "@/shared/domain/date/utils/core";
import { startOfDayInTimezone } from "@/shared/domain/date/utils/timezone";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import { CheerRepository } from "./cheer.repository";
import type {
	CheerCooldownInfo,
	CheerLimitInfo,
	CheerWithRelations,
	SendCheerParams,
} from "./types";

@Injectable()
export class CheerService {
	readonly #logger = new Logger(CheerService.name);

	constructor(
		private readonly cheerRepository: CheerRepository,
		private readonly followFacade: FollowFacade,
		private readonly paginationService: PaginationService,
		private readonly notificationQueueService: NotificationQueueService,
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
		private readonly entitlementService: EntitlementService,
	) {}

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
	async sendCheer(
		params: SendCheerParams,
		tz: string = "UTC",
	): Promise<CheerWithRelations> {
		const { senderId, receiverId, message } = params;

		// 1. 자기 자신 체크
		if (senderId === receiverId) {
			throw BusinessExceptions.cannotCheerSelf();
		}

		// 2. 친구 관계 확인
		const isFriend = await this.followFacade.isMutualFriend(
			senderId,
			receiverId,
		);
		if (!isFriend) {
			throw BusinessExceptions.cheerNotFriend(receiverId);
		}

		const cheer = await this.uow.run(async () => {
			// 3. 일일 제한 체크
			const todayStart = startOfDayInTimezone(now(), tz);

			const entitlement = await this.entitlementService.getFeatureLimitInTx(
				this.txHost.tx,
				senderId,
				Feature.CHEER,
			);

			const used = await this.cheerRepository.countSentSince(
				senderId,
				todayStart,
			);

			this.entitlementService.enforceLimit(entitlement, used, (_used, limit) =>
				BusinessExceptions.cheerDailyLimitExceeded(limit),
			);

			// 4. 쿨다운 체크
			const lastCheer = await this.cheerRepository.findLastCheerToUser({
				senderId,
				receiverId,
			});

			if (lastCheer) {
				const cooldown = calculateCooldown(
					lastCheer.createdAt,
					CHEER_LIMITS.COOLDOWN_HOURS,
				);
				if (cooldown.isActive) {
					throw BusinessExceptions.cheerCooldownActive(
						receiverId,
						cooldown.remainingSeconds,
					);
				}
			}

			// 5. Cheer 생성
			return this.cheerRepository.createWithRelations({
				senderId,
				receiverId,
				message,
			});
		});

		this.#logger.log(
			`Cheer sent: senderId=${senderId}, receiverId=${receiverId}`,
		);

		const senderName = cheer.sender.profile?.name ?? cheer.sender.userTag;
		this.notificationQueueService.enqueueCheerSent({
			cheerId: cheer.id,
			senderId,
			receiverId,
			senderName,
			message,
		});

		return cheer;
	}

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

		this.#logger.debug(
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

		this.#logger.debug(
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

	/**
	 * 일일 응원 제한 정보 조회
	 */
	async getLimitInfo(
		userId: string,
		tz: string = "UTC",
	): Promise<CheerLimitInfo> {
		const { dailyLimit } = await this.entitlementService.getFeatureLimit(
			userId,
			Feature.CHEER,
		);

		const today = startOfDayInTimezone(now(), tz);
		const used = await this.cheerRepository.countTodayCheers({
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

		return this.#calculateCooldownInfo(lastCheer?.createdAt);
	}

	/**
	 * 응원 읽음 처리
	 */
	async markAsRead(userId: string, cheerId: number): Promise<void> {
		const cheer = await this.cheerRepository.findById(cheerId);

		if (!cheer) {
			throw BusinessExceptions.cheerNotFound(cheerId);
		}

		if (cheer.receiverId !== userId) {
			throw BusinessExceptions.cheerNotFound(cheerId);
		}

		if (cheer.readAt) {
			return;
		}

		await this.cheerRepository.markAsRead(cheerId);

		this.#logger.debug(`Cheer marked as read: id=${cheerId}`);
	}

	/**
	 * 여러 응원 읽음 처리
	 */
	async markManyAsRead(userId: string, cheerIds: number[]): Promise<number> {
		const count = await this.cheerRepository.markManyAsRead(cheerIds, userId);

		this.#logger.debug(`${count} cheers marked as read for user: ${userId}`);

		return count;
	}

	/**
	 * 받은 Cheer 총 개수
	 */
	async countReceivedCheers(userId: string): Promise<number> {
		return this.cheerRepository.countReceived(userId);
	}

	/**
	 * 보낸 Cheer 총 개수
	 */
	async countSentCheers(userId: string): Promise<number> {
		return this.cheerRepository.countSent(userId);
	}

	/**
	 * 읽지 않은 받은 Cheer 개수
	 */
	async countUnreadReceivedCheers(userId: string): Promise<number> {
		return this.cheerRepository.countUnreadReceived(userId);
	}

	/**
	 * 쿨다운 정보 계산
	 */
	#calculateCooldownInfo(lastCheerTime?: Date | null): CheerCooldownInfo {
		const { isActive, remainingSeconds, endsAt } = calculateCooldown(
			lastCheerTime ?? null,
			CHEER_LIMITS.COOLDOWN_HOURS,
		);
		return { isActive, remainingSeconds, canCheerAt: endsAt };
	}
}
