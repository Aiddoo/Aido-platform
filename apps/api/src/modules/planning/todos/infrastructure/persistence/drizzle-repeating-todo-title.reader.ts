import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, isNotNull } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todoSeries } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { RepeatingTodoTitleReaderPort } from "../../application/ports/repeating-todo-title.reader.port.js";

@Injectable()
export class DrizzleRepeatingTodoTitleReader implements RepeatingTodoTitleReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  async listActiveTitles(userId: UserId): Promise<string[]> {
    const rows = await this.#transactionHost.tx
      .selectDistinct({ title: todoSeries.title })
      .from(todoSeries)
      .where(and(eq(todoSeries.userId, userId.value), isNotNull(todoSeries.nextOccurrenceDate)));
    return rows.map((row) => row.title);
  }
}
