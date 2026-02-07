import { Injectable } from "@nestjs/common";

import { DatabaseService } from "@/database";
import type { Prisma, UserPreference } from "@/generated/prisma/client";

export interface UpdatePreferenceData {
	pushEnabled?: boolean;
	nightPushEnabled?: boolean;
	timezone?: string;
	morningReminderHour?: number;
	eveningReminderHour?: number;
}

@Injectable()
export class UserPreferenceRepository {
	constructor(private readonly database: DatabaseService) {}

	async findByUserId(
		userId: string,
		tx?: Prisma.TransactionClient,
	): Promise<UserPreference | null> {
		const client = tx ?? this.database;
		return client.userPreference.findUnique({
			where: { userId },
		});
	}

	async create(
		userId: string,
		data?: Partial<UpdatePreferenceData>,
		tx?: Prisma.TransactionClient,
	): Promise<UserPreference> {
		const client = tx ?? this.database;
		return client.userPreference.create({
			data: {
				userId,
				pushEnabled: data?.pushEnabled ?? false,
				nightPushEnabled: data?.nightPushEnabled ?? false,
				...(data?.timezone !== undefined && { timezone: data.timezone }),
				...(data?.morningReminderHour !== undefined && {
					morningReminderHour: data.morningReminderHour,
				}),
				...(data?.eveningReminderHour !== undefined && {
					eveningReminderHour: data.eveningReminderHour,
				}),
			},
		});
	}

	async upsert(
		userId: string,
		data: UpdatePreferenceData,
		tx?: Prisma.TransactionClient,
	): Promise<UserPreference> {
		const client = tx ?? this.database;
		return client.userPreference.upsert({
			where: { userId },
			create: {
				userId,
				pushEnabled: data.pushEnabled ?? false,
				nightPushEnabled: data.nightPushEnabled ?? false,
				...(data.timezone !== undefined && { timezone: data.timezone }),
				...(data.morningReminderHour !== undefined && {
					morningReminderHour: data.morningReminderHour,
				}),
				...(data.eveningReminderHour !== undefined && {
					eveningReminderHour: data.eveningReminderHour,
				}),
			},
			update: {
				...(data.pushEnabled !== undefined && {
					pushEnabled: data.pushEnabled,
				}),
				...(data.nightPushEnabled !== undefined && {
					nightPushEnabled: data.nightPushEnabled,
				}),
				...(data.timezone !== undefined && { timezone: data.timezone }),
				...(data.morningReminderHour !== undefined && {
					morningReminderHour: data.morningReminderHour,
				}),
				...(data.eveningReminderHour !== undefined && {
					eveningReminderHour: data.eveningReminderHour,
				}),
			},
		});
	}

	async update(
		userId: string,
		data: UpdatePreferenceData,
		tx?: Prisma.TransactionClient,
	): Promise<UserPreference> {
		const client = tx ?? this.database;
		return client.userPreference.update({
			where: { userId },
			data: {
				...(data.pushEnabled !== undefined && {
					pushEnabled: data.pushEnabled,
				}),
				...(data.nightPushEnabled !== undefined && {
					nightPushEnabled: data.nightPushEnabled,
				}),
				...(data.timezone !== undefined && { timezone: data.timezone }),
				...(data.morningReminderHour !== undefined && {
					morningReminderHour: data.morningReminderHour,
				}),
				...(data.eveningReminderHour !== undefined && {
					eveningReminderHour: data.eveningReminderHour,
				}),
			},
		});
	}

	/**
	 * 여러 사용자의 푸시 설정 배치 조회 (N+1 방지용)
	 */
	async findByUserIds(
		userIds: string[],
		tx?: Prisma.TransactionClient,
	): Promise<UserPreference[]> {
		if (userIds.length === 0) return [];
		const client = tx ?? this.database;
		return client.userPreference.findMany({
			where: { userId: { in: userIds } },
		});
	}

	/**
	 * 사용자 타임존 upsert (없으면 생성, 있으면 갱신)
	 */
	async upsertTimezone(
		userId: string,
		timezone: string,
		tx?: Prisma.TransactionClient,
	): Promise<void> {
		const client = tx ?? this.database;
		await client.userPreference.upsert({
			where: { userId },
			create: { userId, timezone },
			update: { timezone },
		});
	}
}
