import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { inArray, sql } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { suggestionAnalysisRun } from "#api/platform/database/schema/ai-assistance.schema";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { SuggestionAnalysisRunRepositoryPort } from "../../application/ports/suggestion-analysis-run.repository.port.js";
import type { SuggestionAnalysisRun } from "../../domain/suggestion-analysis-run.entity.js";
import {
  toSuggestionAnalysisRun,
  toSuggestionAnalysisRunRow,
} from "./suggestion-analysis-run-row.mapper.js";

@Injectable()
export class DrizzleSuggestionAnalysisRunRepository extends SuggestionAnalysisRunRepositoryPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#transactionHost = transactionHost;
  }

  get #db() {
    return this.#transactionHost.tx;
  }

  async findByUserId(userId: UserId): Promise<SuggestionAnalysisRun | null> {
    const row = await this.#db.query.suggestionAnalysisRun.findFirst({
      where: { userId: userId.value },
    });
    return row == null ? null : toSuggestionAnalysisRun(row);
  }

  async listByUserIds(userIds: readonly UserId[]): Promise<SuggestionAnalysisRun[]> {
    if (userIds.length === 0) {
      return [];
    }
    const rows = await this.#db
      .select()
      .from(suggestionAnalysisRun)
      .where(
        inArray(
          suggestionAnalysisRun.userId,
          userIds.map((userId) => userId.value),
        ),
      );
    return rows.map(toSuggestionAnalysisRun);
  }

  async save(run: SuggestionAnalysisRun): Promise<void> {
    const row = toSuggestionAnalysisRunRow(run);
    await this.#db
      .insert(suggestionAnalysisRun)
      .values(row)
      .onConflictDoUpdate({ target: suggestionAnalysisRun.userId, set: row });
  }

  async saveMany(runs: readonly SuggestionAnalysisRun[]): Promise<void> {
    if (runs.length === 0) {
      return;
    }
    await this.#db
      .insert(suggestionAnalysisRun)
      .values(runs.map(toSuggestionAnalysisRunRow))
      .onConflictDoUpdate({
        target: suggestionAnalysisRun.userId,
        set: {
          status: sql`excluded."status"`,
          localDate: sql`excluded."localDate"`,
          trigger: sql`excluded."trigger"`,
          outcome: sql`excluded."outcome"`,
          recentTodoCount: sql`excluded."recentTodoCount"`,
          createdSuggestionCount: sql`excluded."createdSuggestionCount"`,
          queuedAt: sql`excluded."queuedAt"`,
          startedAt: sql`excluded."startedAt"`,
          finishedAt: sql`excluded."finishedAt"`,
        },
      });
  }
}
