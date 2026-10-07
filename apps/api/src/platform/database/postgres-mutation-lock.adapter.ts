import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import sql, { join } from "sql-template-tag";

import type { MutationLockPort } from "#api/shared/application/ports/index";

import { sqlStatement } from "./database-sql.js";
import type { Prisma8TransactionalAdapter } from "./prisma8-transactional.adapter.js";

/**
 * PostgreSQL transaction advisory lock 어댑터.
 *
 * 논리 키는 중복 제거 후 사전순으로 정렬해 교착을 방지한다. 각 키는 활성
 * TransactionHost.tx 연결에서 PostgreSQL이 직접 64-bit 해시하고, 트랜잭션
 * 종료 시 자동 해제되는 pg_advisory_xact_lock으로 획득한다.
 */
@Injectable()
export class PostgresMutationLockAdapter implements MutationLockPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  async acquire(keys: readonly string[]): Promise<void> {
    if (!this.txHost.isTransactionActive()) {
      throw new Error("Mutation lock requires an active transaction");
    }

    const orderedKeys = [...new Set(keys)].sort();
    if (orderedKeys.length === 0) {
      return;
    }

    // key 수와 무관하게 한 번 왕복합니다. 내부 정렬 subquery가 모든 호출자에게 같은
    // 잠금 순서를 주므로 여러 댓글을 정리해도 교착 회피 규칙은 유지됩니다.
    const plan = sqlStatement(
      this.txHost.tx,
      sql`
			WITH ordered AS MATERIALIZED (
				SELECT requested."key"
				FROM unnest(ARRAY[${join(orderedKeys)}]::TEXT[]) AS requested("key")
				ORDER BY requested."key"
			)
			SELECT pg_advisory_xact_lock(hashtextextended(ordered."key", 0))::TEXT AS "locked"
			FROM ordered
			ORDER BY ordered."key"
  `,
    )
      .returnsRow({ locked: "pg/text@1" })
      .build();
    await this.txHost.tx.query(plan);
  }
}
