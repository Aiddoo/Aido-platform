import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";

import type { GrowthMetricsSnapshotPort } from "../../application/ports/growth-metrics-snapshot.port.js";

// READ COMMITTED는 문장마다 스냅샷이 달라 활동·가입·활성화 수가 서로 다른 시점을 볼 수 있다
@Injectable()
export class RepeatableReadGrowthMetricsSnapshotAdapter implements GrowthMetricsSnapshotPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  run<T>(work: () => Promise<T>): Promise<T> {
    return this.#transactionHost.withTransaction(
      { isolationLevel: "repeatable read", accessMode: "read only" },
      work,
    );
  }
}
