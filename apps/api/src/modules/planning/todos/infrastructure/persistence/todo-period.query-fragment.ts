import { and, eq, gte, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";

import { todo, todoCategory } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 다른 Context가 한 사람의 기간 안 할 일을 집계·분석하는 하위 질의다. PG가 펼쳐 바로 읽으므로 실행 계획은 테이블 조회와 같다

// 그날에 걸친 할 일의 완료 여부다. 종료일 유무로 갈라야 두 갈래가 각각 날짜 인덱스 범위 조회가 된다
export function todosOnDay(userId: UserId, date: Temporal.PlainDate) {
  return new QueryBuilder()
    .select({ completed: todo.completed })
    .from(todo)
    .where(
      and(
        eq(todo.userId, userId.value),
        or(
          and(isNotNull(todo.endDate), lte(todo.startDate, date), gte(todo.endDate, date)),
          and(isNull(todo.endDate), eq(todo.startDate, date)),
        ),
      ),
    )
    .as("todos_on_day");
}

// 시작일이 [from, until) 안인 할 일이다
export function todosStartingBetween(
  userId: UserId,
  from: Temporal.PlainDate,
  until: Temporal.PlainDate,
) {
  return new QueryBuilder()
    .select({
      startDate: todo.startDate,
      categoryId: todo.categoryId,
      completed: todo.completed,
      completedAt: todo.completedAt,
    })
    .from(todo)
    .where(and(eq(todo.userId, userId.value), gte(todo.startDate, from), lt(todo.startDate, until)))
    .as("todos_starting_between");
}

// 시작일이 [from, through] 안인 반복 아닌 할 일과 카테고리 이름이다. 이름은 부르는 쪽의 LIMIT 뒤에 행마다 읽도록 스칼라 하위 질의로 둔다
export function nonRepeatingTodosStartingWithin(
  userId: UserId,
  period: { readonly from: Temporal.PlainDate; readonly through: Temporal.PlainDate },
) {
  return new QueryBuilder()
    .select({
      title: todo.title,
      startDate: todo.startDate,
      scheduledLocalTime: todo.scheduledLocalTime,
      scheduledTime: todo.scheduledTime,
      categoryId: todo.categoryId,
      completed: todo.completed,
      categoryName: sql<
        string | null
      >`(select ${todoCategory.name} from ${todoCategory} where ${eq(todoCategory.id, todo.categoryId)})`.as(
        "category_name",
      ),
    })
    .from(todo)
    .where(
      and(
        eq(todo.userId, userId.value),
        isNull(todo.seriesId),
        gte(todo.startDate, period.from),
        lte(todo.startDate, period.through),
      ),
    )
    .as("non_repeating_todos");
}
