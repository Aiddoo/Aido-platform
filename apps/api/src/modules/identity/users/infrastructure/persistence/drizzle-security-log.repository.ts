import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { inArray, lt } from "drizzle-orm";

import {
  SecurityLogRepositoryPort,
  type NewSecurityLog,
} from "#api/modules/identity/users/application/ports/security-log.repository.port";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { securityLog } from "#api/platform/database/schema/index";

// 감사 기록이라 시각은 DB now()가 남긴다. 호출자 트랜잭션과 함께 커밋·롤백된다
@Injectable()
export class DrizzleSecurityLogRepository extends SecurityLogRepositoryPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#transactionHost = transactionHost;
  }

  async create(entry: NewSecurityLog): Promise<void> {
    await this.#transactionHost.tx.insert(securityLog).values({
      userId: entry.userId?.value,
      event: entry.event,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      metadata: entry.metadata,
    });
  }

  async deleteRecordedBefore(cutoff: Temporal.Instant, limit: number): Promise<number> {
    const oldLogs = this.#transactionHost.tx
      .select({ id: securityLog.id })
      .from(securityLog)
      .where(lt(securityLog.createdAt, cutoff))
      .limit(limit);
    const deleted = await this.#transactionHost.tx
      .delete(securityLog)
      .where(inArray(securityLog.id, oldLogs))
      .returning({ id: securityLog.id });
    return deleted.length;
  }
}
