import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, gte, isNull, lte, or } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo as todoTable } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { ReminderTargetReaderPort } from "../../application/ports/reminder-target.reader.port.js";

@Injectable()
export class DrizzleReminderTargetReader implements ReminderTargetReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  countTodosOn(ownerId: UserId, date: Temporal.PlainDate): Promise<number> {
    return this.#db.$count(
      todoTable,
      and(
        eq(todoTable.userId, ownerId.value),
        or(
          and(lte(todoTable.startDate, date), gte(todoTable.endDate, date)),
          and(eq(todoTable.startDate, date), isNull(todoTable.endDate)),
        ),
      ),
    );
  }
}
