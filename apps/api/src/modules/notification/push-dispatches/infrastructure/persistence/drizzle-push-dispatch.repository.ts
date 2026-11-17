import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { pushDispatch, pushDispatchOutbox } from "#api/platform/database/schema/index";
import { nextSequenceValues } from "#api/platform/database/sequence";

import type { PushDispatchRepositoryPort } from "../../application/ports/push-dispatch.repository.port.js";
import { PushDispatchId } from "../../domain/push-dispatch-id.vo.js";
import type { PushDispatch } from "../../domain/push-dispatch.aggregate.js";
import { toPushDispatchOutboxRow, toPushDispatchRow } from "./push-dispatch-row.mapper.js";

@Injectable()
export class DrizzlePushDispatchRepository implements PushDispatchRepositoryPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  async nextIds(count: number): Promise<PushDispatchId[]> {
    const values = await nextSequenceValues(this.#db, pushDispatch.id, count);
    return values.map((value) => PushDispatchId.reconstitute(value));
  }

  async saveAll(dispatches: readonly PushDispatch[]): Promise<void> {
    if (dispatches.length === 0) {
      return;
    }
    await this.#db.insert(pushDispatch).values(dispatches.map(toPushDispatchRow));
    await this.#db.insert(pushDispatchOutbox).values(dispatches.map(toPushDispatchOutboxRow));
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
