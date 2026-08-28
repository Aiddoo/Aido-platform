import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { Injectable } from "@nestjs/common";

import { now } from "@/shared/domain/date/utils/core";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { isRecordNotFoundError } from "@/shared/infrastructure/database/prisma-error.util";

import type {
	FindPushTokensParams,
	RegisterPushTokenData,
} from "../../application/ports/notification-data";
import {
	PushTokenNotFoundError,
	type PushTokenRepositoryPort,
} from "../../application/ports/push-token.repository.port";
import type { PushTokenRecord } from "../../domain/records/notification.record";

@Injectable()
export class PrismaPushTokenRepository implements PushTokenRepositoryPort {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>,
	) {}

	private get client() {
		return this.txHost.tx;
	}

	async registerPushToken(data: RegisterPushTokenData): Promise<PushTokenRecord> {
		const deviceId = data.deviceId ?? "default";
		const platform = data.platform ?? "IOS";

		return this.client.pushToken.upsert({
			where: { userId_deviceId: { userId: data.userId, deviceId } },
			create: {
				userId: data.userId,
				token: data.token,
				deviceId,
				platform,
				isActive: true,
				payloadVersion: data.payloadVersion ?? 1,
				appVersion: data.appVersion,
			},
			update: {
				token: data.token,
				platform,
				isActive: true,
				payloadVersion: data.payloadVersion ?? 1,
				appVersion: data.appVersion,
				updatedAt: now(),
			},
		});
	}

	async findPushTokensByUser(params: FindPushTokensParams): Promise<PushTokenRecord[]> {
		return this.client.pushToken.findMany({
			where: {
				userId: params.userId,
				...(params.activeOnly && { isActive: true }),
			},
			orderBy: { updatedAt: "desc" },
		});
	}

	async findActivePushTokensByUsers(userIds: string[]): Promise<PushTokenRecord[]> {
		return this.client.pushToken.findMany({
			where: { userId: { in: userIds }, isActive: true },
		});
	}

	async deletePushToken(userId: string, deviceId: string): Promise<PushTokenRecord> {
		try {
			return await this.client.pushToken.delete({
				where: { userId_deviceId: { userId, deviceId } },
			});
		} catch (error) {
			if (isRecordNotFoundError(error)) {
				throw new PushTokenNotFoundError();
			}
			throw error;
		}
	}

	async deleteAllPushTokensByUser(userId: string): Promise<{ count: number }> {
		return this.client.pushToken.deleteMany({ where: { userId } });
	}

	async deactivateInvalidTokens(tokens: string[]): Promise<{ count: number }> {
		return this.client.pushToken.updateMany({
			where: { token: { in: tokens } },
			data: { isActive: false },
		});
	}
}
