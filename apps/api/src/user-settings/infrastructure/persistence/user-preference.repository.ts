import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import type { UserPreference } from "@/generated/prisma/client";
import type { TimeFormat } from "@/generated/prisma/enums";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import type { UserPreferenceRepositoryPort } from "../../application/ports/user-preference.repository.port";

export interface UpdatePreferenceData {
	pushEnabled?: boolean;
	nightPushEnabled?: boolean;
	timezone?: string;
	morningReminderHour?: number;
	morningReminderMinute?: number;
	eveningReminderHour?: number;
	eveningReminderMinute?: number;
	timeFormat?: TimeFormat;
	weatherMorningEnabled?: boolean;
	weatherMorningHour?: number;
	weatherMorningMinute?: number;
	weatherEveningEnabled?: boolean;
	weatherEveningHour?: number;
	weatherEveningMinute?: number;
}

@Injectable()
export class UserPreferenceRepository implements UserPreferenceRepositoryPort {
	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
	) {}

	/** 활성 트랜잭션(없으면 베이스 클라이언트) */
	private get client() {
		return this.txHost.tx;
	}

	async findByUserId(userId: string): Promise<UserPreference | null> {
		return this.client.userPreference.findUnique({
			where: { userId },
		});
	}

	async create(
		userId: string,
		data?: Partial<UpdatePreferenceData>,
	): Promise<UserPreference> {
		return this.client.userPreference.create({
			data: {
				userId,
				pushEnabled: data?.pushEnabled ?? true,
				nightPushEnabled: data?.nightPushEnabled ?? true,
				...(data?.timezone !== undefined && { timezone: data.timezone }),
				...(data?.morningReminderHour !== undefined && {
					morningReminderHour: data.morningReminderHour,
				}),
				...(data?.morningReminderMinute !== undefined && {
					morningReminderMinute: data.morningReminderMinute,
				}),
				...(data?.eveningReminderHour !== undefined && {
					eveningReminderHour: data.eveningReminderHour,
				}),
				...(data?.eveningReminderMinute !== undefined && {
					eveningReminderMinute: data.eveningReminderMinute,
				}),
				...(data?.timeFormat !== undefined && {
					timeFormat: data.timeFormat,
				}),
			},
		});
	}

	async upsert(
		userId: string,
		data: UpdatePreferenceData,
	): Promise<UserPreference> {
		return this.client.userPreference.upsert({
			where: { userId },
			create: {
				userId,
				pushEnabled: data.pushEnabled ?? true,
				nightPushEnabled: data.nightPushEnabled ?? true,
				...(data.timezone !== undefined && { timezone: data.timezone }),
				...(data.morningReminderHour !== undefined && {
					morningReminderHour: data.morningReminderHour,
				}),
				...(data.morningReminderMinute !== undefined && {
					morningReminderMinute: data.morningReminderMinute,
				}),
				...(data.eveningReminderHour !== undefined && {
					eveningReminderHour: data.eveningReminderHour,
				}),
				...(data.eveningReminderMinute !== undefined && {
					eveningReminderMinute: data.eveningReminderMinute,
				}),
				...(data.timeFormat !== undefined && {
					timeFormat: data.timeFormat,
				}),
			},
			update: this.buildUpdatePayload(data),
		});
	}

	async update(
		userId: string,
		data: UpdatePreferenceData,
	): Promise<UserPreference> {
		return this.client.userPreference.update({
			where: { userId },
			data: this.buildUpdatePayload(data),
		});
	}

	private buildUpdatePayload(data: UpdatePreferenceData) {
		return {
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
			...(data.morningReminderMinute !== undefined && {
				morningReminderMinute: data.morningReminderMinute,
			}),
			...(data.eveningReminderHour !== undefined && {
				eveningReminderHour: data.eveningReminderHour,
			}),
			...(data.eveningReminderMinute !== undefined && {
				eveningReminderMinute: data.eveningReminderMinute,
			}),
			...(data.timeFormat !== undefined && {
				timeFormat: data.timeFormat,
			}),
			...(data.weatherMorningEnabled !== undefined && {
				weatherMorningEnabled: data.weatherMorningEnabled,
			}),
			...(data.weatherMorningHour !== undefined && {
				weatherMorningHour: data.weatherMorningHour,
			}),
			...(data.weatherMorningMinute !== undefined && {
				weatherMorningMinute: data.weatherMorningMinute,
			}),
			...(data.weatherEveningEnabled !== undefined && {
				weatherEveningEnabled: data.weatherEveningEnabled,
			}),
			...(data.weatherEveningHour !== undefined && {
				weatherEveningHour: data.weatherEveningHour,
			}),
			...(data.weatherEveningMinute !== undefined && {
				weatherEveningMinute: data.weatherEveningMinute,
			}),
		};
	}

	/**
	 * 여러 사용자의 푸시 설정 배치 조회 (N+1 방지용)
	 */
	async findByUserIds(userIds: string[]): Promise<UserPreference[]> {
		if (userIds.length === 0) return [];
		return this.client.userPreference.findMany({
			where: { userId: { in: userIds } },
		});
	}

	/**
	 * 스트릭 필드 업데이트
	 */
	async updateStreak(
		userId: string,
		data: {
			currentStreak: number;
			longestStreak: number;
			lastCompletedDate: Date | null;
		},
	): Promise<void> {
		await this.client.userPreference.update({
			where: { userId },
			data: {
				currentStreak: data.currentStreak,
				longestStreak: data.longestStreak,
				lastCompletedDate: data.lastCompletedDate,
			},
		});
	}

	/**
	 * 사용자 타임존 upsert (없으면 생성, 있으면 갱신)
	 */
	async upsertTimezone(userId: string, timezone: string): Promise<void> {
		await this.client.userPreference.upsert({
			where: { userId },
			create: { userId, timezone },
			update: { timezone },
		});
	}

	/**
	 * 사용자 푸시 언어 upsert (없으면 생성, 있으면 갱신) — 토큰 등록 시 Accept-Language 동기화
	 */
	async upsertLocale(userId: string, locale: string): Promise<void> {
		await this.client.userPreference.upsert({
			where: { userId },
			create: { userId, locale },
			update: { locale },
		});
	}
}
