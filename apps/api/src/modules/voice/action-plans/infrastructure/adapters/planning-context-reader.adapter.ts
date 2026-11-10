import { Inject, Injectable } from "@nestjs/common";

import {
  PLANNING_CATEGORY_LIMIT,
  PLANNING_UPCOMING_TODO_LIMIT,
} from "#api/modules/ai-assistance/planning/ai-assistance-planning.public";
import {
  TODO_CATEGORY_READER,
  type TodoCategoryReaderPort,
} from "#api/modules/planning/categories/planning-categories.public";
import {
  TODO_PLAN_READER,
  type TodoPlanReaderPort,
} from "#api/modules/planning/todos/planning-todos.public";
import { todayInTimezone } from "#api/shared/domain/date/utils/timezone";

import type {
  PlanningContext,
  PlanningContextReaderPort,
} from "../../application/ports/planning-context.reader.port.js";

/** 카테고리 id·이름과 다가오는 할 일을 읽기만 한다. 다른 Context의 공개 포트로만 읽는다. */
@Injectable()
export class PlanningContextReaderAdapter implements PlanningContextReaderPort {
  readonly #categoryReader: Pick<TodoCategoryReaderPort, "listForUser">;
  readonly #todoReader: Pick<TodoPlanReaderPort, "findUpcoming">;

  constructor(
    @Inject(TODO_CATEGORY_READER)
    categoryReader: Pick<TodoCategoryReaderPort, "listForUser">,
    @Inject(TODO_PLAN_READER)
    todoReader: Pick<TodoPlanReaderPort, "findUpcoming">,
  ) {
    this.#categoryReader = categoryReader;
    this.#todoReader = todoReader;
  }

  async read(userId: string, timezone: string): Promise<PlanningContext> {
    const [categories, upcomingTodos] = await Promise.all([
      this.#categoryReader.listForUser(userId),
      this.#todoReader.findUpcoming(userId, {
        fromDate: todayInTimezone(timezone),
        limit: PLANNING_UPCOMING_TODO_LIMIT,
      }),
    ]);
    return {
      categories: categories
        .slice(0, PLANNING_CATEGORY_LIMIT)
        .map(({ id, name }) => ({ id, name })),
      upcomingTodos,
    };
  }

  async findOwnedCategoryIds(userId: string): Promise<ReadonlySet<number>> {
    const categories = await this.#categoryReader.listForUser(userId);
    return new Set(categories.map((category) => category.id));
  }
}
