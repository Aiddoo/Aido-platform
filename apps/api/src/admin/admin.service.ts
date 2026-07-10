import { BROADCAST_TARGET_FILTER } from "@aido/validators";
import { Injectable, Logger } from "@nestjs/common";
import { BusinessExceptions } from "@/shared/application/exceptions/business-exception.service";
import { subtractDays } from "@/shared/domain/date/utils/arithmetic";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { forEachBatch } from "@/shared/infrastructure/database/utils/batch-cursor.util";

import { NotificationService } from "../notification/notification.service";
import type { BroadcastNotificationDto, TargetedNotificationDto } from "./dtos";

const BROADCAST_BATCH_SIZE = 500;

export interface BroadcastResult {
	successCount: number;
	failCount: number;
	totalTargets: number;
}

@Injectable()
export class AdminService {
	readonly #logger = new Logger(AdminService.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly notificationService: NotificationService,
	) {}

	/**
	 * 전체/조건부 알림 발송
	 *
	 * 대상 필터에 따라 사용자를 조회하고 알림을 발송합니다.
	 */
	async broadcastNotification(
		dto: BroadcastNotificationDto,
	): Promise<BroadcastResult> {
		const { title, body, targetFilter, action } = dto;
		const whereClause = this.#buildTargetWhere(targetFilter);
		const metadata = action?.url ? { externalUrl: action.url } : undefined;

		let totalTargets = 0;
		let successCount = 0;

		await forEachBatch({
			batchSize: BROADCAST_BATCH_SIZE,
			fetchPage: (cursor, take) =>
				this.database.user.findMany({
					where: {
						...whereClause,
						...(cursor && { id: { gt: cursor } }),
					},
					select: { id: true },
					orderBy: { id: "asc" },
					take,
				}),
			onBatch: async (batch) => {
				totalTargets += batch.length;

				const notifications = batch.map((user) => ({
					userId: user.id,
					type: "ADMIN_BROADCAST" as const,
					title,
					body,
					action,
					metadata,
				}));

				const result =
					await this.notificationService.createAndSendBatch(notifications);
				successCount += result.count;
			},
		});

		if (totalTargets === 0) {
			throw BusinessExceptions.adminNotificationTargetNotFound();
		}

		this.#logger.log(
			`Broadcast notification completed: ${successCount}/${totalTargets} sent, filter=${targetFilter}`,
		);

		return {
			successCount,
			failCount: totalTargets - successCount,
			totalTargets,
		};
	}

	/**
	 * 특정 사용자 알림 발송
	 */
	async sendTargetedNotification(
		dto: TargetedNotificationDto,
	): Promise<BroadcastResult> {
		const { title, body, userIds, action } = dto;
		const metadata = action?.url ? { externalUrl: action.url } : undefined;

		// 존재하는 사용자만 필터링
		const existingUsers = await this.database.user.findMany({
			where: {
				id: { in: userIds },
				deletedAt: null,
			},
			select: { id: true },
		});

		const existingUserIds = existingUsers.map((u) => u.id);

		if (existingUserIds.length === 0) {
			throw BusinessExceptions.adminNotificationTargetNotFound();
		}

		this.#logger.log(
			`Sending targeted notification to ${existingUserIds.length} users`,
		);

		// 알림 데이터 생성
		const notifications = existingUserIds.map((userId) => ({
			userId,
			type: "ADMIN_TARGETED" as const,
			title,
			body,
			action,
			metadata,
		}));

		// 배치로 알림 생성 및 발송
		const result =
			await this.notificationService.createAndSendBatch(notifications);

		this.#logger.log(
			`Targeted notification completed: ${result.count} notifications sent`,
		);

		return {
			successCount: result.count,
			failCount: existingUserIds.length - result.count,
			totalTargets: existingUserIds.length,
		};
	}

	/**
	 * 대상 필터에 따른 사용자 ID 조회
	 */
	#buildTargetWhere(
		targetFilter: (typeof BROADCAST_TARGET_FILTER)[keyof typeof BROADCAST_TARGET_FILTER],
	): Record<string, unknown> {
		const baseWhere = {
			deletedAt: null,
			status: "ACTIVE" as const,
		};

		switch (targetFilter) {
			case BROADCAST_TARGET_FILTER.ALL:
				return baseWhere;

			case BROADCAST_TARGET_FILTER.WITH_PUSH_TOKEN:
				return { ...baseWhere, pushTokens: { some: {} } };

			case BROADCAST_TARGET_FILTER.ACTIVE_LAST_7_DAYS:
				return { ...baseWhere, lastLoginAt: { gte: subtractDays(7) } };

			case BROADCAST_TARGET_FILTER.ACTIVE_LAST_30_DAYS:
				return { ...baseWhere, lastLoginAt: { gte: subtractDays(30) } };

			case BROADCAST_TARGET_FILTER.SUBSCRIBERS:
				return { ...baseWhere, subscriptionStatus: "ACTIVE" };

			default:
				throw BusinessExceptions.adminInvalidFilterCondition({
					targetFilter,
				});
		}
	}
}
