import { Injectable } from "@nestjs/common";

import { subtractDays } from "@/common/date/utils";
import { DatabaseService } from "@/database";
import type {
	Prisma,
	SecurityEvent,
	SecurityLog,
} from "@/generated/prisma/client";

export interface CreateSecurityLogData {
	userId?: string;
	event: SecurityEvent;
	ipAddress: string;
	userAgent: string;
	metadata?: Record<string, unknown>;
}

@Injectable()
export class SecurityLogRepository {
	constructor(private readonly database: DatabaseService) {}

	async create(
		data: CreateSecurityLogData,
		tx?: Prisma.TransactionClient,
	): Promise<SecurityLog> {
		const client = tx ?? this.database;
		return client.securityLog.create({
			data: {
				userId: data.userId,
				event: data.event,
				ipAddress: data.ipAddress,
				userAgent: data.userAgent,
				metadata: data.metadata as Prisma.JsonObject | undefined,
			},
		});
	}

	async findByUserId(
		userId: string,
		options?: {
			limit?: number;
			events?: SecurityEvent[];
		},
	): Promise<SecurityLog[]> {
		return this.database.securityLog.findMany({
			where: {
				userId,
				...(options?.events && { event: { in: options.events } }),
			},
			orderBy: { createdAt: "desc" },
			take: options?.limit ?? 50,
		});
	}

	async findRecentByEvent(
		event: SecurityEvent,
		since: Date,
		options?: {
			userId?: string;
			ipAddress?: string;
			limit?: number;
		},
	): Promise<SecurityLog[]> {
		return this.database.securityLog.findMany({
			where: {
				event,
				createdAt: { gte: since },
				...(options?.userId && { userId: options.userId }),
				...(options?.ipAddress && { ipAddress: options.ipAddress }),
			},
			orderBy: { createdAt: "desc" },
			take: options?.limit ?? 100,
		});
	}

	async findSuspiciousActivityByIp(
		ipAddress: string,
		since: Date,
	): Promise<SecurityLog[]> {
		return this.database.securityLog.findMany({
			where: {
				ipAddress,
				createdAt: { gte: since },
				event: {
					in: [
						"LOGIN_FAILURE",
						"SUSPICIOUS_ACTIVITY",
						"TOKEN_REVOKED",
						"SESSION_REVOKED_ALL",
					],
				},
			},
			orderBy: { createdAt: "desc" },
		});
	}

	// 배치 작업용, 90일 보관
	async deleteOld(retentionDays = 90): Promise<number> {
		const cutoff = subtractDays(retentionDays);

		const result = await this.database.securityLog.deleteMany({
			where: {
				createdAt: { lt: cutoff },
			},
		});
		return result.count;
	}

	async countByEvent(
		since: Date,
		until?: Date,
	): Promise<{ event: SecurityEvent; count: number }[]> {
		const result = await this.database.securityLog.groupBy({
			by: ["event"],
			where: {
				createdAt: {
					gte: since,
					...(until && { lte: until }),
				},
			},
			_count: { event: true },
		});

		return result.map((r) => ({
			event: r.event,
			count: r._count.event,
		}));
	}
}
