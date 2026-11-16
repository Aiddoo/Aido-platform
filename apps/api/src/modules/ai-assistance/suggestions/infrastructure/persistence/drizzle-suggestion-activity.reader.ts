import { AI_SUGGESTION_LIMITS } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate } from "#api/shared/domain/time/instant";

import {
  localDateAt,
  localDateTimeAt,
} from "../../../shared/domain/user-calendar.domain-service.js";
import { SuggestionActivityReaderPort } from "../../application/ports/suggestion-activity.reader.port.js";
import type {
  SuggestionHistoryItem,
  TodoSummaryForAnalysis,
} from "../../domain/suggestion.constants.js";

// planning Todo.startDate는 달력 날짜 칸이라 같은 현지 날짜를 PlainDate로 비교한다
function localDay(value: Date, timezone: string): Temporal.PlainDate {
  return localDateAt(value, timezone);
}

function toWallClock(local: Temporal.ZonedDateTime): string {
  return local.toPlainTime().toString({ smallestUnit: "minute" });
}

/** 제안 분석용 활동 projection. planning·제안 테이블을 읽는다(공개 조회 포트로 옮기는 것은 후속). */
@Injectable()
export class DrizzleSuggestionActivityReader extends SuggestionActivityReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async findRecentTodos(
    userId: UserId,
    from: Date,
    to: Date,
    timezone: string,
  ): Promise<TodoSummaryForAnalysis[]> {
    const todos = await this.#db.query.todo.findMany({
      columns: {
        title: true,
        startDate: true,
        scheduledLocalTime: true,
        scheduledTime: true,
        categoryId: true,
        completed: true,
      },
      with: { category: { columns: { name: true } } },
      where: {
        userId: userId.value,
        seriesId: { isNull: true },
        startDate: { gte: localDay(from, timezone), lte: localDay(to, timezone) },
      },
      // 최근 기록부터 상한까지만 읽고, 기존 소비 순서(날짜 오름차순)로 되돌린다.
      orderBy: { startDate: "desc" },
      limit: AI_SUGGESTION_LIMITS.MAX_ANALYSIS_TODOS,
    });

    return todos.toReversed().map((t) => ({
      title: t.title,
      startDate: t.startDate.toString(),
      scheduledTime:
        t.scheduledTime == null
          ? null
          : (t.scheduledLocalTime ?? toWallClock(localDateTimeAt(t.scheduledTime, timezone))),
      categoryId: t.categoryId,
      completed: t.completed,
      categoryName: requireRecord(t.category).name,
    }));
  }

  async findRecentResponded(userId: UserId, since: Date): Promise<SuggestionHistoryItem[]> {
    const rows = await this.#db.query.recurringSuggestion.findMany({
      columns: { title: true, status: true },
      where: {
        userId: userId.value,
        status: { in: ["ACCEPTED", "DISMISSED"] },
        updatedAt: { gte: instantFromDate(since) },
      },
    });

    return rows.map((row) => ({
      title: row.title,
      status: row.status === "ACCEPTED" ? "ACCEPTED" : "DISMISSED",
    }));
  }
}
