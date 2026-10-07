import { Propagation, TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { SavepointRunnerPort } from "#api/shared/application/ports/index";

import type { Prisma8TransactionalAdapter } from "./prisma8-transactional.adapter.js";

@Injectable()
export class ClsSavepointRunner implements SavepointRunnerPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    if (!this.txHost.isTransactionActive()) {
      throw new Error("A savepoint requires an active Unit of Work");
    }

    return this.txHost.withTransaction(Propagation.Nested, work);
  }
}
