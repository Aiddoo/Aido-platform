import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { reminderNudge as reminderNudgeTable } from "#api/platform/database/schema/index";
import { nextSequenceValue } from "#api/platform/database/sequence";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { ReminderNudgeRepositoryPort } from "../../application/ports/reminder-nudge.repository.port.js";
import { ReminderNudgeId } from "../../domain/reminder-nudge-id.vo.js";
import type { ReminderNudge } from "../../domain/reminder-nudge.aggregate.js";
import { toReminderNudge, toReminderNudgeRow } from "./reminder-nudge-row.mapper.js";

@Injectable()
export class DrizzleReminderNudgeRepository implements ReminderNudgeRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async nextId(): Promise<ReminderNudgeId> {
    return ReminderNudgeId.reconstitute(await nextSequenceValue(this.#db, reminderNudgeTable.id));
  }

  async findLastSentTo(senderId: UserId, receiverId: UserId): Promise<ReminderNudge | null> {
    const row = await this.#db.query.reminderNudge.findFirst({
      where: { senderId: senderId.value, receiverId: receiverId.value },
      orderBy: { createdAt: "desc" },
    });
    return row == null ? null : toReminderNudge(row);
  }

  async save(reminder: ReminderNudge): Promise<void> {
    await this.#db.insert(reminderNudgeTable).values(toReminderNudgeRow(reminder));
  }
}
