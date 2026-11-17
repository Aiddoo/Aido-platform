import { AI_SUGGESTION_LIMITS } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { desc } from "drizzle-orm";

import { nonRepeatingTodosStartingWithin } from "#api/modules/planning/todos/planning-todos-queries.public";
import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { localDateTimeAt } from "../../../shared/domain/user-calendar.domain-service.js";
import { SuggestionActivityReaderPort } from "../../application/ports/suggestion-activity.reader.port.js";
import type { SuggestionAnalysisPeriod } from "../../domain/suggestion-dispatch-window.domain-service.js";
import type {
  SuggestionHistoryItem,
  TodoSummaryForAnalysis,
} from "../../domain/suggestions.constants.js";

function toWallClock(local: Temporal.ZonedDateTime): string {
  return local.toPlainTime().toString({ smallestUnit: "minute" });
}

/** 제안 분석용 활동 projection. 할 일은 planning이 연 하위 질의로 읽는다. */
@Injectable()
export class DrizzleSuggestionActivityReader extends SuggestionActivityReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#transactionHost = transactionHost;
  }

  async findRecentTodos(
    userId: UserId,
    period: SuggestionAnalysisPeriod,
    timezone: string,
  ): Promise<TodoSummaryForAnalysis[]> {
    const recent = nonRepeatingTodosStartingWithin(userId, {
      from: period.from,
      through: period.to,
    });
    // 최근 기록부터 상한까지만 읽고, 기존 소비 순서(날짜 오름차순)로 되돌린다.
    const todos = await this.#db
      .select()
      .from(recent)
      .orderBy(desc(recent.startDate))
      .limit(AI_SUGGESTION_LIMITS.MAX_ANALYSIS_TODOS);

    return todos.toReversed().map((t) => ({
      title: t.title,
      startDate: t.startDate.toString(),
      scheduledTime:
        t.scheduledTime == null
          ? null
          : (t.scheduledLocalTime ?? toWallClock(localDateTimeAt(t.scheduledTime, timezone))),
      categoryId: t.categoryId,
      completed: t.completed,
      categoryName: requireRecord(t.categoryName),
    }));
  }

  async findRecentResponded(
    userId: UserId,
    since: Temporal.Instant,
  ): Promise<SuggestionHistoryItem[]> {
    const rows = await this.#db.query.suggestion.findMany({
      columns: { title: true, status: true },
      where: {
        userId: userId.value,
        status: { in: ["ACCEPTED", "DISMISSED"] },
        updatedAt: { gte: since },
      },
      orderBy: { updatedAt: "desc" },
    });

    return rows.map((row) => ({
      title: row.title,
      status: row.status === "ACCEPTED" ? "ACCEPTED" : "DISMISSED",
    }));
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
