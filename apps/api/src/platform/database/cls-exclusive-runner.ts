import { Propagation, TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";

import type {
  ExclusiveRunnerPort,
  ExclusiveRunResult,
} from "#api/shared/application/ports/exclusive-runner.port";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";

import type { DrizzleTransactionalAdapter } from "./database.client.js";

/**
 * 트랜잭션 advisory try-lock을 쥔 트랜잭션을 열어 두고 work는 그 트랜잭션 밖에서 돌린다.
 * work가 잠금 트랜잭션에 합류하면 모든 쓰기가 한 트랜잭션이 되어 행 잠금을 끝까지 쥐기 때문이다.
 */
@Injectable()
export class ClsExclusiveRunner implements ExclusiveRunnerPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #mutationLock: MutationLockPort;

  constructor(
    transactionHost: TransactionHost<DrizzleTransactionalAdapter>,
    mutationLock: MutationLockPort,
  ) {
    this.#transactionHost = transactionHost;
    this.#mutationLock = mutationLock;
  }

  async run<T>(key: string, work: () => Promise<T>): Promise<ExclusiveRunResult<T>> {
    if (this.#transactionHost.isTransactionActive()) {
      throw new Error("An exclusive run must start outside a Unit of Work");
    }

    return this.#transactionHost.withTransaction(async (): Promise<ExclusiveRunResult<T>> => {
      if (!(await this.#mutationLock.tryAcquire([key]))) {
        return { status: "held" };
      }
      // 잠금만 쥔 트랜잭션은 work 동안 쉬므로 이 트랜잭션에서만 앱 풀의 idle 끊김(60초)을 끈다
      await this.#transactionHost.tx.execute(
        sql`SELECT set_config('idle_in_transaction_session_timeout', '0', true)`,
      );
      const value = await this.#transactionHost.withTransaction(Propagation.NotSupported, work);
      return { status: "ran", value };
    });
  }
}
