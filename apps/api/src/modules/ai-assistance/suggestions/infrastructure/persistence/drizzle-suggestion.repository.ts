import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, lt, sql } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { suggestion as suggestionTable } from "#api/platform/database/schema/ai-assistance.schema";
import { nextSequenceValues } from "#api/platform/database/sequence";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { SuggestionRepositoryPort } from "../../application/ports/suggestion.repository.port.js";
import { SuggestionId } from "../../domain/suggestion-id.vo.js";
import type { Suggestion } from "../../domain/suggestion.aggregate.js";
import { toSuggestion, toSuggestionRow } from "./suggestion-row.mapper.js";

@Injectable()
export class DrizzleSuggestionRepository extends SuggestionRepositoryPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#transactionHost = transactionHost;
  }

  get #db() {
    return this.#transactionHost.tx;
  }

  async nextIds(count: number): Promise<SuggestionId[]> {
    const ids = await nextSequenceValues(this.#db, suggestionTable.id, count);
    return ids.map((id) => SuggestionId.reconstitute(id));
  }

  async saveMany(suggestions: readonly Suggestion[]): Promise<void> {
    if (suggestions.length === 0) {
      return;
    }
    await this.#db
      .insert(suggestionTable)
      .values(suggestions.map(toSuggestionRow))
      .onConflictDoUpdate({
        target: suggestionTable.id,
        set: {
          status: sql`excluded."status"`,
          updatedAt: sql`excluded."updatedAt"`,
        },
      });
  }

  async save(suggestion: Suggestion): Promise<void> {
    const row = toSuggestionRow(suggestion);
    await this.#db
      .insert(suggestionTable)
      .values(row)
      .onConflictDoUpdate({ target: suggestionTable.id, set: row });
  }

  async findByIdAndUserId(suggestionId: SuggestionId, userId: UserId): Promise<Suggestion | null> {
    const row = await this.#db.query.suggestion.findFirst({
      where: { id: suggestionId.value, userId: userId.value },
    });
    return row == null ? null : toSuggestion(row);
  }

  async listPendingByUserId(userId: UserId, now: Temporal.Instant): Promise<Suggestion[]> {
    const rows = await this.#db.query.suggestion.findMany({
      where: { userId: userId.value, status: "PENDING", expiresAt: { gt: now } },
      orderBy: { createdAt: "desc", id: "desc" },
    });
    return rows.map(toSuggestion);
  }

  async deletePendingByUserId(userId: UserId): Promise<number> {
    const deleted = await this.#db
      .delete(suggestionTable)
      .where(and(eq(suggestionTable.userId, userId.value), eq(suggestionTable.status, "PENDING")))
      .returning({ id: suggestionTable.id });
    return deleted.length;
  }

  async deleteExpiredByUserId(userId: UserId, now: Temporal.Instant): Promise<number> {
    const deleted = await this.#db
      .delete(suggestionTable)
      .where(and(eq(suggestionTable.userId, userId.value), lt(suggestionTable.expiresAt, now)))
      .returning({ id: suggestionTable.id });
    return deleted.length;
  }
}
