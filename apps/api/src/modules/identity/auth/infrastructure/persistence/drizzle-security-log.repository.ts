import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import {
  AuthSecurityLogRepositoryPort,
  type NewSecurityLog,
} from "#api/modules/identity/auth/application/ports/auth-security-log.repository.port";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { securityLog } from "#api/platform/database/schema/index";

// 감사 기록이라 시각은 DB now()가 남긴다. 호출자 트랜잭션과 함께 커밋·롤백된다
@Injectable()
export class DrizzleSecurityLogRepository extends AuthSecurityLogRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#txHost = txHost;
  }

  async create(entry: NewSecurityLog): Promise<void> {
    await this.#txHost.tx.insert(securityLog).values({
      userId: entry.userId?.value,
      event: entry.event,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      metadata: entry.metadata,
    });
  }
}
