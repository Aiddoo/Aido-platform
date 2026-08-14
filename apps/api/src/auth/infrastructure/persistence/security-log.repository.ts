import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { Injectable } from "@nestjs/common";

import type { SecurityEvent, SecurityLog } from "@/generated/prisma/client";
import { subtractDays } from "@/shared/domain/date/utils/arithmetic";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { toInputJson } from "@/shared/infrastructure/database/json.util";

export interface CreateSecurityLogData {
	userId?: string;
	event: SecurityEvent;
	ipAddress: string;
	userAgent: string;
	metadata?: Record<string, unknown>;
}

@Injectable()
export class SecurityLogRepository {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>,
	) {}

	/** 활성 트랜잭션(없으면 베이스 클라이언트) */
	private get client() {
		return this.txHost.tx;
	}

	async create(data: CreateSecurityLogData): Promise<SecurityLog> {
		return this.client.securityLog.create({
			data: {
				userId: data.userId,
				event: data.event,
				ipAddress: data.ipAddress,
				userAgent: data.userAgent,
				metadata: data.metadata === undefined ? undefined : toInputJson(data.metadata),
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
		return this.client.securityLog.findMany({
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
		return this.client.securityLog.findMany({
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

	async findSuspiciousActivityByIp(ipAddress: string, since: Date): Promise<SecurityLog[]> {
		return this.client.securityLog.findMany({
			where: {
				ipAddress,
				createdAt: { gte: since },
				event: {
					in: ["LOGIN_FAILURE", "SUSPICIOUS_ACTIVITY", "TOKEN_REVOKED", "SESSION_REVOKED_ALL"],
				},
			},
			orderBy: { createdAt: "desc" },
		});
	}

	// 배치 작업용, 90일 보관
	async deleteOld(retentionDays = 90): Promise<number> {
		const cutoff = subtractDays(retentionDays);

		const result = await this.client.securityLog.deleteMany({
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
		const result = await this.client.securityLog.groupBy({
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
