import { Injectable } from "@nestjs/common";

import { TodoCompletionGroupReaderPort } from "#api/modules/planning/todos/planning-todo-queries.public";

import {
  type DailyCompletionRangeQuery,
  DailyCompletionRepositoryPort,
} from "../../application/ports/daily-completion.repository.port.js";
import { tallyDailyCompletions } from "../../domain/daily-completion.domain-service.js";
import type { DailyCompletion } from "../../domain/daily-completion.entity.js";

// 할 일 테이블은 planning이 소유해 planning 조회 포트로 묶음 수를 받고 날짜별로 펼치는 일만 여기서 한다
@Injectable()
export class DailyCompletionRepositoryAdapter implements DailyCompletionRepositoryPort {
  readonly #groupReader: Pick<TodoCompletionGroupReaderPort, "listCompletionGroups">;

  constructor(groupReader: TodoCompletionGroupReaderPort) {
    this.#groupReader = groupReader;
  }

  listByDateRange(query: DailyCompletionRangeQuery): Promise<DailyCompletion[]> {
    return this.#listCompletions(query, false);
  }

  listPublicByDateRange(query: DailyCompletionRangeQuery): Promise<DailyCompletion[]> {
    return this.#listCompletions(query, true);
  }

  async #listCompletions(
    { userId, range }: DailyCompletionRangeQuery,
    publicOnly: boolean,
  ): Promise<DailyCompletion[]> {
    const groups = await this.#groupReader.listCompletionGroups({
      userId,
      start: range.start,
      end: range.end,
      publicOnly,
    });
    if (groups.length === 0) {
      return [];
    }
    return tallyDailyCompletions({ userId, range, groups });
  }
}
