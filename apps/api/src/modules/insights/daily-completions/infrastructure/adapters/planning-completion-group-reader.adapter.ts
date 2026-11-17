import { Injectable } from "@nestjs/common";

import { TodoCompletionGroupReaderPort } from "#api/modules/planning/todos/planning-todo-queries.public";

import {
  type CompletionGroupQuery,
  CompletionGroupReaderPort,
} from "../../application/ports/completion-group.reader.port.js";
import type { TodoCompletionGroup } from "../../domain/daily-completion.domain-service.js";

@Injectable()
export class PlanningCompletionGroupReaderAdapter extends CompletionGroupReaderPort {
  readonly #groupReader: Pick<TodoCompletionGroupReaderPort, "listCompletionGroups">;

  constructor(groupReader: TodoCompletionGroupReaderPort) {
    super();
    this.#groupReader = groupReader;
  }

  listByDateRange(query: CompletionGroupQuery): Promise<TodoCompletionGroup[]> {
    return this.#listGroups(query, false);
  }

  listPublicByDateRange(query: CompletionGroupQuery): Promise<TodoCompletionGroup[]> {
    return this.#listGroups(query, true);
  }

  #listGroups(
    { userId, range }: CompletionGroupQuery,
    publicOnly: boolean,
  ): Promise<TodoCompletionGroup[]> {
    return this.#groupReader.listCompletionGroups({
      userId,
      start: range.start,
      end: range.end,
      publicOnly,
    });
  }
}
