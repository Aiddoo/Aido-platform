import { Propagation, TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { SavepointRunnerPort } from "#api/shared/application/ports/savepoint-runner.port";

import type { DrizzleTransactionalAdapter } from "./database.client.js";

@Injectable()
export class ClsSavepointRunner implements SavepointRunnerPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  run<T>(work: () => Promise<T>): Promise<T> {
    if (!this.#transactionHost.isTransactionActive()) {
      throw new Error("A savepoint requires an active Unit of Work");
    }

    return this.#transactionHost.withTransaction(Propagation.Nested, work);
  }
}
