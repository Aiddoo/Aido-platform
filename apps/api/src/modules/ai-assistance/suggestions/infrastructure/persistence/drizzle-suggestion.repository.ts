import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, lt, sql } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { recurringSuggestion } from "#api/platform/database/schema/ai-assistance.schema";
import { nextSequenceValues } from "#api/platform/database/sequence";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { SuggestionRepositoryPort } from "../../application/ports/suggestion.repository.port.js";
import { SuggestionId } from "../../domain/suggestion-id.vo.js";
import type { Suggestion } from "../../domain/suggestion.aggregate.js";
import { toSuggestion, toSuggestionRow } from "./suggestion-row.mapper.js";

@Injectable()
export class DrizzleSuggestionRepository extends SuggestionRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async nextIds(count: number): Promise<SuggestionId[]> {
    const ids = await nextSequenceValues(this.#db, recurringSuggestion.id, count);
    return ids.map((id) => SuggestionId.reconstitute(id));
  }

  async saveMany(suggestions: readonly Suggestion[]): Promise<void> {
    if (suggestions.length === 0) {
      return;
    }
    await this.#db
      .insert(recurringSuggestion)
      .values(suggestions.map(toSuggestionRow))
      .onConflictDoUpdate({
        target: recurringSuggestion.id,
        set: {
          status: sql`excluded."status"`,
          updatedAt: sql`excluded."updatedAt"`,
        },
      });
  }

  async save(suggestion: Suggestion): Promise<void> {
    const row = toSuggestionRow(suggestion);
    await this.#db
      .insert(recurringSuggestion)
      .values(row)
      .onConflictDoUpdate({ target: recurringSuggestion.id, set: row });
  }

  async findByIdAndUserId(suggestionId: SuggestionId, userId: UserId): Promise<Suggestion | null> {
    const row = await this.#db.query.recurringSuggestion.findFirst({
      where: { id: suggestionId.value, userId: userId.value },
    });
    return row == null ? null : toSuggestion(row);
  }

  async listPendingByUserId(userId: UserId, now: Temporal.Instant): Promise<Suggestion[]> {
    const rows = await this.#db.query.recurringSuggestion.findMany({
      where: { userId: userId.value, status: "PENDING", expiresAt: { gt: now } },
      orderBy: { createdAt: "desc", id: "desc" },
    });
    return rows.map(toSuggestion);
  }

  async deletePendingByUserId(userId: UserId): Promise<number> {
    const deleted = await this.#db
      .delete(recurringSuggestion)
      .where(
        and(
          eq(recurringSuggestion.userId, userId.value),
          eq(recurringSuggestion.status, "PENDING"),
        ),
      )
      .returning({ id: recurringSuggestion.id });
    return deleted.length;
  }

  async deleteExpiredByUserId(userId: UserId, now: Temporal.Instant): Promise<number> {
    const deleted = await this.#db
      .delete(recurringSuggestion)
      .where(
        and(eq(recurringSuggestion.userId, userId.value), lt(recurringSuggestion.expiresAt, now)),
      )
      .returning({ id: recurringSuggestion.id });
    return deleted.length;
  }
}
