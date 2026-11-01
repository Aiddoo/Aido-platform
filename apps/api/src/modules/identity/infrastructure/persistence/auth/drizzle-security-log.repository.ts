import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, count, desc, eq, gte, inArray, lt, lte } from "drizzle-orm";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { securityLog } from "#api/platform/database/schema/index";
import { subtractDays } from "#api/shared/domain/date/utils/arithmetic";

type SecurityLogRow = typeof securityLog.$inferSelect;
type SecurityEvent = SecurityLogRow["event"];

export interface CreateSecurityLogData {
  userId?: string;
  event: SecurityEvent;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class DrizzleSecurityLogRepository {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  async create(data: CreateSecurityLogData): Promise<SecurityLogRow> {
    const [row] = await this.db
      .insert(securityLog)
      .values({
        userId: data.userId,
        event: data.event,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: data.metadata,
      })
      .returning();
    return requireRecord(row);
  }

  async findByUserId(
    userId: string,
    options?: {
      limit?: number;
      events?: SecurityEvent[];
    },
  ): Promise<SecurityLogRow[]> {
    return this.db
      .select()
      .from(securityLog)
      .where(
        and(
          eq(securityLog.userId, userId),
          options?.events ? inArray(securityLog.event, options.events) : undefined,
        ),
      )
      .orderBy(desc(securityLog.createdAt))
      .limit(options?.limit ?? 50);
  }

  async findRecentByEvent(
    event: SecurityEvent,
    since: Date,
    options?: {
      userId?: string;
      ipAddress?: string;
      limit?: number;
    },
  ): Promise<SecurityLogRow[]> {
    return this.db
      .select()
      .from(securityLog)
      .where(
        and(
          eq(securityLog.event, event),
          gte(securityLog.createdAt, since),
          options?.userId ? eq(securityLog.userId, options.userId) : undefined,
          options?.ipAddress ? eq(securityLog.ipAddress, options.ipAddress) : undefined,
        ),
      )
      .orderBy(desc(securityLog.createdAt))
      .limit(options?.limit ?? 100);
  }

  async findSuspiciousActivityByIp(ipAddress: string, since: Date): Promise<SecurityLogRow[]> {
    return this.db
      .select()
      .from(securityLog)
      .where(
        and(
          eq(securityLog.ipAddress, ipAddress),
          gte(securityLog.createdAt, since),
          inArray(securityLog.event, [
            "LOGIN_FAILURE",
            "SUSPICIOUS_ACTIVITY",
            "TOKEN_REVOKED",
            "SESSION_REVOKED_ALL",
          ]),
        ),
      )
      .orderBy(desc(securityLog.createdAt));
  }

  // 배치 작업용, 90일 보관
  async deleteOld(retentionDays = 90): Promise<number> {
    const cutoff = subtractDays(retentionDays);
    const deleted = await this.db
      .delete(securityLog)
      .where(lt(securityLog.createdAt, cutoff))
      .returning({ id: securityLog.id });
    return deleted.length;
  }

  async countByEvent(
    since: Date,
    until?: Date,
  ): Promise<{ event: SecurityEvent; count: number }[]> {
    return this.db
      .select({ event: securityLog.event, count: count() })
      .from(securityLog)
      .where(
        and(
          gte(securityLog.createdAt, since),
          until == null ? undefined : lte(securityLog.createdAt, until),
        ),
      )
      .groupBy(securityLog.event);
  }
}
