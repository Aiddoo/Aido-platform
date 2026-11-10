import { Injectable } from "@nestjs/common";

import {
  PLANNING_CATEGORY_LIMIT,
  PLANNING_UPCOMING_TODO_LIMIT,
} from "#api/modules/ai-assistance/planning/ai-assistance-planning.public";
import { TodoCategoryReaderPort } from "#api/modules/planning/categories/planning-categories.public";
import { TodoPlanReaderPort } from "#api/modules/planning/todos/planning-todos.public";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { TimeZone } from "#api/shared/domain/time/time-zone.vo";
import { localDateOf } from "#api/shared/domain/time/zoned-time";

import {
  type PlanningContext,
  PlanningContextReaderPort,
} from "../../application/ports/planning-context.reader.port.js";

// 옛 날짜 함수(todayInTimezone)처럼 알 수 없는 시간대는 계획을 멈추지 않고 UTC 오늘로 본다
function toPlanningTimeZone(raw: string): TimeZone {
  try {
    return TimeZone.create(raw);
  } catch {
    return TimeZone.UTC;
  }
}

/** 카테고리 id·이름과 다가오는 할 일을 읽기만 한다. 다른 Context의 공개 포트로만 읽는다. */
@Injectable()
export class PlanningContextReaderAdapter extends PlanningContextReaderPort {
  readonly #categoryReader: Pick<TodoCategoryReaderPort, "listForUser">;
  readonly #todoReader: Pick<TodoPlanReaderPort, "findUpcoming">;
  readonly #clock: ClockPort;

  constructor(
    categoryReader: TodoCategoryReaderPort,
    todoReader: TodoPlanReaderPort,
    clock: ClockPort,
  ) {
    super();
    this.#categoryReader = categoryReader;
    this.#todoReader = todoReader;
    this.#clock = clock;
  }

  async read(userId: UserId, timezone: string): Promise<PlanningContext> {
    const today = localDateOf(this.#clock.now(), toPlanningTimeZone(timezone));
    const [categories, upcomingTodos] = await Promise.all([
      this.#categoryReader.listForUser(userId),
      this.#todoReader.findUpcoming(userId, {
        fromDate: today,
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

  async findOwnedCategoryIds(userId: UserId): Promise<ReadonlySet<number>> {
    const categories = await this.#categoryReader.listForUser(userId);
    return new Set(categories.map((category) => category.id));
  }
}
