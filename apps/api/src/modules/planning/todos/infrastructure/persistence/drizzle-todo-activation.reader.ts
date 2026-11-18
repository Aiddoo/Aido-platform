import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { toIsoString } from "#api/shared/domain/time/instant";

import {
  type TodoActivityWindow,
  TodoActivationReaderPort,
} from "../../application/ports/todo-activation.reader.port.js";

const createdTodo = alias(todo, "created_todo");
const completedTodo = alias(todo, "completed_todo");

// 사용자 수만큼 묻지 않도록 구간을 배열 세 개로 펼쳐 한 문장으로 읽는다. 할 일 시각 칸은 UTC 벽시계 timestamp(3)다
@Injectable()
export class DrizzleTodoActivationReader extends TodoActivationReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#transactionHost = transactionHost;
  }

  async listActivatedUserIds(windows: readonly TodoActivityWindow[]): Promise<UserId[]> {
    if (windows.length === 0) {
      return [];
    }
    const userIds = windows.map((activityWindow) => activityWindow.userId.value);
    const froms = windows.map((activityWindow) => toIsoString(activityWindow.from));
    const untils = windows.map((activityWindow) => toIsoString(activityWindow.until));

    const { rows } = await this.#transactionHost.tx.execute<{ userId: string }>(sql`
      SELECT activity_window."userId"
      FROM unnest(
        ${sql.param(userIds)}::TEXT[],
        ${sql.param(froms)}::TIMESTAMP(3)[],
        ${sql.param(untils)}::TIMESTAMP(3)[]
      ) AS activity_window("userId", "from", "until")
      WHERE EXISTS (
          SELECT 1
          FROM ${todo} AS created_todo
          WHERE ${createdTodo.userId} = activity_window."userId"
            AND ${createdTodo.createdAt} >= activity_window."from"
            AND ${createdTodo.createdAt} <= activity_window."until"
        )
        AND EXISTS (
          SELECT 1
          FROM ${todo} AS completed_todo
          WHERE ${completedTodo.userId} = activity_window."userId"
            AND ${completedTodo.completedAt} >= activity_window."from"
            AND ${completedTodo.completedAt} <= activity_window."until"
        )
    `);
    return rows.map((row) => UserId.reconstitute(row.userId));
  }
}
