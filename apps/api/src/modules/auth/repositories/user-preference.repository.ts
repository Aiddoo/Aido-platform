import { Injectable } from "@nestjs/common";

import { DatabaseService } from "@/database";
import type { Prisma, UserPreference } from "@/generated/prisma/client";

export interface UpdatePreferenceData {
	pushEnabled?: boolean;
	nightPushEnabled?: boolean;
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
			},
			update: {
				...(data.pushEnabled !== undefined && {
					pushEnabled: data.pushEnabled,
				}),
				...(data.nightPushEnabled !== undefined && {
					nightPushEnabled: data.nightPushEnabled,
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
			},
		});
	}
}
