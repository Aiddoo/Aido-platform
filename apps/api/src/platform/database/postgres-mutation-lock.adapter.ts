import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { uniq } from "es-toolkit";

import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";

import type { DrizzleTransactionalAdapter } from "./database.client.js";

/**
 * PostgreSQL transaction advisory lock 어댑터.
 *
 * 키를 중복 제거·정렬해 모든 호출자가 같은 순서로 잠그므로 교착이 생기지 않는다.
 * 잠금은 트랜잭션이 끝나면 자동 해제된다.
 */
@Injectable()
export class PostgresMutationLockAdapter implements MutationLockPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  async acquire(keys: readonly string[]): Promise<void> {
    const orderedKeys = this.#orderedKeysInTransaction(keys);
    if (orderedKeys.length === 0) {
      return;
    }

    await this.#transactionHost.tx.execute(sql`
      WITH ordered AS MATERIALIZED (
        SELECT requested."key"
        FROM unnest(${sql.param(orderedKeys)}::TEXT[]) AS requested("key")
        ORDER BY requested."key"
      )
      SELECT pg_advisory_xact_lock(hashtextextended(ordered."key", 0))
      FROM ordered
      ORDER BY ordered."key"
    `);
  }

  async tryAcquire(keys: readonly string[]): Promise<boolean> {
    const orderedKeys = this.#orderedKeysInTransaction(keys);
    if (orderedKeys.length === 0) {
      return true;
    }

    const { rows } = await this.#transactionHost.tx.execute<{ isAcquired: boolean }>(sql`
      WITH ordered AS MATERIALIZED (
        SELECT requested."key"
        FROM unnest(${sql.param(orderedKeys)}::TEXT[]) AS requested("key")
        ORDER BY requested."key"
      )
      SELECT pg_try_advisory_xact_lock(hashtextextended(ordered."key", 0)) AS "isAcquired"
      FROM ordered
      ORDER BY ordered."key"
    `);
    return rows.length === orderedKeys.length && rows.every((row) => row.isAcquired);
  }

  #orderedKeysInTransaction(keys: readonly string[]): string[] {
    if (!this.#transactionHost.isTransactionActive()) {
      throw new Error("Mutation lock requires an active transaction");
    }
    return uniq(keys).toSorted();
  }
}
