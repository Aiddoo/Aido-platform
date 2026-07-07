import { Injectable, Logger } from "@nestjs/common";
import { subtractDays } from "@/common/date/utils/arithmetic";
import { diffInDays } from "@/common/date/utils/compare";
import { todayInTimezone } from "@/common/date/utils/timezone";
import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { NotificationMessageBuilder } from "@/modules/notification/templates/notification-templates";
import { fetchUserLocales } from "@/modules/notification/templates/user-locale.util";
import type { CreateNotificationData } from "@/modules/notification/types/notification.types";

import {
	ONBOARDING_DAYS,
	ONBOARDING_MAX_DAY,
} from "../../constants/reminder.constants";
import type {
	ITimezoneStrategy,
	TimezoneContext,
} from "./timezone-reminder-strategy.interface";

/** 완료 수 조회가 필요한 온보딩 day */
const DAYS_REQUIRING_COMPLETED_COUNT = new Set([5, 7]);

@Injectable()
export class OnboardingStrategy implements ITimezoneStrategy {
	readonly #logger = new Logger(OnboardingStrategy.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly notificationService: NotificationService,
	) {}

	async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
		const { tz } = ctx;
		const today = todayInTimezone(tz);
		const cutoffDate = subtractDays(ONBOARDING_MAX_DAY, today);

		// 가입 0~7일 + 해당 timezone 유저 조회
		const users = await this.database.user.findMany({
			where: {
				createdAt: { gte: cutoffDate },
				preference: { timezone: tz },
			},
			select: { id: true, createdAt: true },
		});

		if (users.length === 0) {
			return { sent: 0 };
		}

		// 발송 대상 day에 해당하는 유저만 필터
		const onboardingDaySet = new Set<number>(ONBOARDING_DAYS);
		const eligibleUsers = users
			.map((user) => ({
				user,
				day: diffInDays(today, user.createdAt),
			}))
			.filter(({ day }) => onboardingDaySet.has(day));

		if (eligibleUsers.length === 0) {
			return { sent: 0 };
		}

		// 오늘 SYSTEM_NOTICE 중복 방지
		const alreadyNotified =
			await this.notificationService.findAlreadyNotifiedUserIds({
				userIds: eligibleUsers.map(({ user }) => user.id),
				type: "SYSTEM_NOTICE",
				notificationDate: today,
			});

		const filteredUsers = eligibleUsers.filter(
			({ user }) => !alreadyNotified.has(user.id),
		);

		if (filteredUsers.length === 0) {
			return { sent: 0 };
		}

		// Day 5, 7 유저는 completedCount 조회
		const needsCountUserIds = filteredUsers
			.filter(({ day }) => DAYS_REQUIRING_COMPLETED_COUNT.has(day))
			.map(({ user }) => user.id);

		const completedCountMap = new Map<string, number>();
		if (needsCountUserIds.length > 0) {
			const counts = await this.database.todo.groupBy({
				by: ["userId"],
				where: {
					userId: { in: needsCountUserIds },
					completed: true,
				},
				_count: { id: true },
			});

			for (const row of counts) {
				completedCountMap.set(row.userId, row._count.id);
			}
		}

		// 알림 데이터 생성
		const locales = await fetchUserLocales(
			this.database,
			filteredUsers.map(({ user }) => user.id),
		);
		const notifications: CreateNotificationData[] = [];
		for (const { user, day } of filteredUsers) {
			const completedCount = completedCountMap.get(user.id) ?? 0;
			const message = NotificationMessageBuilder.onboarding(
				day,
				completedCount,
				locales.get(user.id) ?? "ko",
			);

			if (!message) continue;

			notifications.push({
				userId: user.id,
				type: "SYSTEM_NOTICE",
				title: message.title,
				body: message.body,
				notificationDate: today,
				metadata: { onboardingDay: day },
			});
		}

		if (notifications.length > 0) {
			await this.notificationService.createAndSendBatch(notifications);
			this.#logger.log(`Onboarding: tz=${tz}, count=${notifications.length}`);
		}

		return { sent: notifications.length };
	}
}
