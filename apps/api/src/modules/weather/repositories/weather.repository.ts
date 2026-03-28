import { Injectable } from "@nestjs/common";

import type { TransactionClient } from "@/common/database/prisma.types";
import { DatabaseService } from "@/database/database.service";
import type { UserLocation } from "@/generated/prisma/client";

export interface UpsertLocationData {
	latitude: number;
	longitude: number;
	gridX: number;
	gridY: number;
}

@Injectable()
export class WeatherRepository {
	constructor(private readonly database: DatabaseService) {}

	async findByUserId(
		userId: string,
		tx?: TransactionClient,
	): Promise<UserLocation | null> {
		const db = tx ?? this.database;
		return db.userLocation.findUnique({ where: { userId } });
	}

	async upsert(
		userId: string,
		data: UpsertLocationData,
		tx?: TransactionClient,
	): Promise<UserLocation> {
		const db = tx ?? this.database;
		return db.userLocation.upsert({
			where: { userId },
			create: { userId, ...data },
			update: data,
		});
	}

	async delete(userId: string, tx?: TransactionClient): Promise<void> {
		const db = tx ?? this.database;
		await db.userLocation.deleteMany({ where: { userId } });
	}
}
