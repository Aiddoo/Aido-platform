import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import type { UserLocation } from "@/generated/prisma/client";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

export interface UpsertLocationData {
	latitude: number;
	longitude: number;
	gridX: number;
	gridY: number;
}

@Injectable()
export class WeatherRepository {
	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
	) {}

	/** 활성 트랜잭션(없으면 베이스 클라이언트) */
	private get client() {
		return this.txHost.tx;
	}

	async findByUserId(userId: string): Promise<UserLocation | null> {
		return this.client.userLocation.findUnique({ where: { userId } });
	}

	async upsert(
		userId: string,
		data: UpsertLocationData,
	): Promise<UserLocation> {
		return this.client.userLocation.upsert({
			where: { userId },
			create: { userId, ...data },
			update: data,
		});
	}

	async delete(userId: string): Promise<void> {
		await this.client.userLocation.deleteMany({ where: { userId } });
	}
}
