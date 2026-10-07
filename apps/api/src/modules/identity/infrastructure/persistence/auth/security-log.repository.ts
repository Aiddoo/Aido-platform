import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { all, and } from "@prisma/orm-postgres/orm-client";

import { decodeRecord, encodeCreate } from "#api/platform/database/database-records";
import { databaseTimestamp, varchar } from "#api/platform/database/database-values";
import type { SecurityEvent, SecurityLog } from "#api/platform/database/database.types";
import { toInputJson } from "#api/platform/database/json.util";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import { subtractDays } from "#api/shared/domain/date/utils/arithmetic";

export interface CreateSecurityLogData {
  userId?: string;
  event: SecurityEvent;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class SecurityLogRepository {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  /** 활성 트랜잭션(없으면 베이스 클라이언트) */
  private get client() {
    return this.txHost.tx;
  }

  async create(data: CreateSecurityLogData): Promise<SecurityLog> {
    return this.client.orm.public.SecurityLog.create(
      encodeCreate("SecurityLog", {
        userId: data.userId,
        event: data.event,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: data.metadata === undefined ? undefined : toInputJson(data.metadata),
      }),
    ).then((row) => decodeRecord("SecurityLog", row));
  }

  async findByUserId(
    userId: string,
    options?: {
      limit?: number;
      events?: SecurityEvent[];
    },
  ): Promise<SecurityLog[]> {
    return this.client.orm.public.SecurityLog.where((row) =>
      and(row.userId.eq(userId), options?.events ? row.event.in(options.events) : all()),
    )
      .orderBy((row) => row.createdAt.desc())
      .limit(options?.limit ?? 50)
      .all()
      .then((row) => decodeRecord("SecurityLog", row));
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
    return this.client.orm.public.SecurityLog.where((row) =>
      and(
        row.event.eq(event),
        row.createdAt.gte(databaseTimestamp(since)),
        options?.userId ? row.userId.eq(options.userId) : all(),
        options?.ipAddress ? row.ipAddress.eq(varchar(options.ipAddress, 45)) : all(),
      ),
    )
      .orderBy((row) => row.createdAt.desc())
      .limit(options?.limit ?? 100)
      .all()
      .then((row) => decodeRecord("SecurityLog", row));
  }

  async findSuspiciousActivityByIp(ipAddress: string, since: Date): Promise<SecurityLog[]> {
    return this.client.orm.public.SecurityLog.where((row) =>
      and(
        row.ipAddress.eq(varchar(ipAddress, 45)),
        row.createdAt.gte(databaseTimestamp(since)),
        row.event.in([
          "LOGIN_FAILURE",
          "SUSPICIOUS_ACTIVITY",
          "TOKEN_REVOKED",
          "SESSION_REVOKED_ALL",
        ]),
      ),
    )
      .orderBy((row) => row.createdAt.desc())
      .all()
      .then((row) => decodeRecord("SecurityLog", row));
  }

  // 배치 작업용, 90일 보관
  async deleteOld(retentionDays = 90): Promise<number> {
    const cutoff = subtractDays(retentionDays);

    const result = {
      count: await this.client.orm.public.SecurityLog.where((row) =>
        row.createdAt.lt(databaseTimestamp(cutoff)),
      ).deleteAndCount(),
    };
    return result.count;
  }

  async countByEvent(
    since: Date,
    until?: Date,
  ): Promise<{ event: SecurityEvent; count: number }[]> {
    return this.client.orm.public.SecurityLog.where((row) =>
      and(
        row.createdAt.gte(databaseTimestamp(since)),
        until === undefined ? all() : row.createdAt.lte(databaseTimestamp(until)),
      ),
    )
      .groupBy("event")
      .aggregate((aggregate) => ({ count: aggregate.count() }));
  }
}
