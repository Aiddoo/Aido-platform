import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { Injectable } from "@nestjs/common";

import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import type { WeatherLocationRepositoryPort } from "../../application/ports/weather-location.repository.port";
import { UserLocation } from "../../domain/entities/user-location.entity";

/**
 * WeatherLocationRepositoryPort의 Prisma 어댑터.
 *
 * UserLocation 애그리게잇을 Prisma UserLocation 행으로 매핑한다. 트랜잭션은 CLS로
 * 전파된다 — TransactionHost.tx가 활성 트랜잭션(없으면 베이스)을 반환.
 */
@Injectable()
export class PrismaWeatherLocationRepository implements WeatherLocationRepositoryPort {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>,
	) {}

	private get client() {
		return this.txHost.tx;
	}

	async findByUserId(userId: string): Promise<UserLocation | null> {
		const row = await this.client.userLocation.findUnique({
			where: { userId },
		});
		return row ? UserLocation.reconstitute(row) : null;
	}

	async upsert(location: UserLocation): Promise<UserLocation> {
		const data = {
			latitude: location.latitude,
			longitude: location.longitude,
			gridX: location.gridX,
			gridY: location.gridY,
		};
		const row = await this.client.userLocation.upsert({
			where: { userId: location.userId },
			create: { userId: location.userId, ...data },
			update: data,
		});
		return UserLocation.reconstitute(row);
	}
}
