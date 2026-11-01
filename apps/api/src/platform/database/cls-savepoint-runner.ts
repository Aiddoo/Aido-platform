import { Propagation, TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { SavepointRunnerPort } from "#api/shared/application/ports/index";

import type { DrizzleTransactionalAdapter } from "./database.client.js";

@Injectable()
export class ClsSavepointRunner implements SavepointRunnerPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    if (!this.txHost.isTransactionActive()) {
      throw new Error("A savepoint requires an active Unit of Work");
    }

    return this.txHost.withTransaction(Propagation.Nested, work);
  }
}
