import { BROADCAST_TARGET_FILTER } from "@aido/validators";
import { Injectable, Logger } from "@nestjs/common";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import { DatabaseService } from "@/database/database.service";

import { NotificationService } from "../notification/notification.service";
import type { BroadcastNotificationDto, TargetedNotificationDto } from "./dto";

export interface BroadcastResult {
	successCount: number;
	failCount: number;
	totalTargets: number;
}

@Injectable()
export class AdminService {
	private readonly logger = new Logger(AdminService.name);

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
		const { title, body, targetFilter } = dto;

		// 대상 사용자 조회
		const targetUsers = await this.getTargetUsers(targetFilter);

		if (targetUsers.length === 0) {
			throw BusinessExceptions.adminNotificationTargetNotFound();
		}

		this.logger.log(
			`Broadcasting notification to ${targetUsers.length} users with filter: ${targetFilter}`,
		);

		// 알림 데이터 생성
		const notifications = targetUsers.map((userId) => ({
			userId,
			type: "ADMIN_BROADCAST" as const,
			title,
			body,
		}));

		// 배치로 알림 생성 및 발송
		const result =
			await this.notificationService.createAndSendBatch(notifications);

		this.logger.log(
			`Broadcast notification completed: ${result.count} notifications sent`,
		);

		return {
			successCount: result.count,
			failCount: targetUsers.length - result.count,
			totalTargets: targetUsers.length,
		};
	}

	/**
	 * 특정 사용자 알림 발송
	 */
	async sendTargetedNotification(
		dto: TargetedNotificationDto,
	): Promise<BroadcastResult> {
		const { title, body, userIds } = dto;

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

		this.logger.log(
			`Sending targeted notification to ${existingUserIds.length} users`,
		);

		// 알림 데이터 생성
		const notifications = existingUserIds.map((userId) => ({
			userId,
			type: "ADMIN_TARGETED" as const,
			title,
			body,
		}));

		// 배치로 알림 생성 및 발송
		const result =
			await this.notificationService.createAndSendBatch(notifications);

		this.logger.log(
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
	private async getTargetUsers(
		targetFilter: (typeof BROADCAST_TARGET_FILTER)[keyof typeof BROADCAST_TARGET_FILTER],
	): Promise<string[]> {
		const baseWhere = {
			deletedAt: null,
			status: "ACTIVE" as const,
		};

		switch (targetFilter) {
			case BROADCAST_TARGET_FILTER.ALL: {
				// 모든 활성 사용자
				const users = await this.database.user.findMany({
					where: baseWhere,
					select: { id: true },
				});
				return users.map((u) => u.id);
			}

			case BROADCAST_TARGET_FILTER.WITH_PUSH_TOKEN: {
				// 푸시 토큰이 있는 사용자만
				const users = await this.database.user.findMany({
					where: {
						...baseWhere,
						pushTokens: { some: {} },
					},
					select: { id: true },
				});
				return users.map((u) => u.id);
			}

			case BROADCAST_TARGET_FILTER.ACTIVE_LAST_7_DAYS: {
				// 최근 7일 로그인 사용자
				const sevenDaysAgo = new Date();
				sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

				const users = await this.database.user.findMany({
					where: {
						...baseWhere,
						lastLoginAt: { gte: sevenDaysAgo },
					},
					select: { id: true },
				});
				return users.map((u) => u.id);
			}

			case BROADCAST_TARGET_FILTER.ACTIVE_LAST_30_DAYS: {
				// 최근 30일 로그인 사용자
				const thirtyDaysAgo = new Date();
				thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

				const users = await this.database.user.findMany({
					where: {
						...baseWhere,
						lastLoginAt: { gte: thirtyDaysAgo },
					},
					select: { id: true },
				});
				return users.map((u) => u.id);
			}

			case BROADCAST_TARGET_FILTER.SUBSCRIBERS: {
				// 유료 구독자
				const users = await this.database.user.findMany({
					where: {
						...baseWhere,
						subscriptionStatus: "ACTIVE",
					},
					select: { id: true },
				});
				return users.map((u) => u.id);
			}

			default:
				throw BusinessExceptions.adminInvalidFilterCondition({
					targetFilter,
				});
		}
	}
}
