import { and, count, eq, exists, gte, inArray, isNull, lt, sql, type SQL } from "drizzle-orm";
import { QueryBuilder, type AnyPgColumn } from "drizzle-orm/pg-core";

import { todo } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 다른 Context가 사람 id 칸 옆에 그 사람의 할 일(시작일 구간)을 한 SQL로 붙이는 조건·하위 질의다. 구간은 [from, until)이다

function startsBetween(from: Temporal.PlainDate, until: Temporal.PlainDate): SQL | undefined {
  return and(gte(todo.startDate, from), lt(todo.startDate, until));
}

export function todoCountBetween(
  userIdColumn: AnyPgColumn,
  from: Temporal.PlainDate,
  until: Temporal.PlainDate,
): SQL<number> {
  return sql<number>`(select count(*) from ${todo} where ${and(eq(todo.userId, userIdColumn), startsBetween(from, until))})`.mapWith(
    Number,
  );
}

// 구간 안 할 일마다 완료 여부 하나다. 순서는 정하지 않는다
export function todoCompletionsBetween(
  userIdColumn: AnyPgColumn,
  from: Temporal.PlainDate,
  until: Temporal.PlainDate,
): SQL<boolean[]> {
  return sql<
    boolean[]
  >`array(select ${todo.completed} from ${todo} where ${and(eq(todo.userId, userIdColumn), startsBetween(from, until))})`;
}

export function hasTodoBetween(
  userIdColumn: AnyPgColumn,
  from: Temporal.PlainDate,
  until: Temporal.PlainDate,
  completed?: boolean,
): SQL {
  return exists(
    new QueryBuilder()
      .select({ one: sql`1` })
      .from(todo)
      .where(
        and(
          eq(todo.userId, userIdColumn),
          startsBetween(from, until),
          completed == null ? undefined : eq(todo.completed, completed),
        ),
      ),
  );
}

// 시작일이 from 이후인 반복 아닌 할 일이 있다
export function hasNonRepeatingTodoFrom(userIdColumn: AnyPgColumn, from: Temporal.PlainDate): SQL {
  return exists(
    new QueryBuilder()
      .select({ one: sql`1` })
      .from(todo)
      .where(and(eq(todo.userId, userIdColumn), gte(todo.startDate, from), isNull(todo.seriesId))),
  );
}

// 사람마다 끝낸 할 일 수다. 끝낸 할 일이 없는 사람은 행이 없다
export function completedTodoCountsByUser(userIds: readonly UserId[]) {
  return new QueryBuilder()
    .select({ userId: todo.userId, count: count().as("completed_count") })
    .from(todo)
    .where(
      and(
        inArray(
          todo.userId,
          userIds.map((userId) => userId.value),
        ),
        eq(todo.completed, true),
      ),
    )
    .groupBy(todo.userId)
    .as("completed_todo_counts");
}

// 여러 날 할 일은 기간 [periodStart, periodEnd) 안에 걸친 날마다 하나로 센다. 끝없이 긴 할 일도 기간 안의 날만 더한다.
// 부르는 쪽의 사람 조건(ownerCondition)은 집계 전 WHERE에 붙여 고를 사람의 할 일만 센다
export function todoDaysInPeriodByUser(params: {
  readonly periodStart: Temporal.PlainDate;
  readonly periodEnd: Temporal.PlainDate;
  readonly completedOnly: boolean;
  readonly ownerCondition: (userIdColumn: AnyPgColumn) => SQL;
}) {
  const firstDay = sql`${sql.param(params.periodStart, todo.startDate)}::date`;
  const lastDay = sql`(${sql.param(params.periodEnd, todo.startDate)}::date - 1)`;
  const todoLastDay = sql`coalesce(${todo.endDate}, ${todo.startDate})`;
  const daysInPeriod = sql<number>`sum(greatest(0, least(${todoLastDay}, ${lastDay}) - greatest(${todo.startDate}, ${firstDay}) + 1))::int`;
  return new QueryBuilder()
    .select({ userId: todo.userId, count: daysInPeriod.as("todo_days") })
    .from(todo)
    .where(
      and(
        sql`${todo.startDate} <= ${lastDay}`,
        sql`${todoLastDay} >= ${firstDay}`,
        params.completedOnly ? eq(todo.completed, true) : undefined,
        params.ownerCondition(todo.userId),
      ),
    )
    .groupBy(todo.userId)
    .as("todo_days_by_user");
}

// 사람 id 칸마다 그 사람의 할 일 행(만든 시각·완료 여부·완료 시각)을 붙이는 lateral 하위 질의다. 집계는 부르는 쪽이 한다
export function todoActivityRowsOf(userIdColumn: AnyPgColumn) {
  return new QueryBuilder()
    .select({ createdAt: todo.createdAt, completed: todo.completed, completedAt: todo.completedAt })
    .from(todo)
    .where(eq(todo.userId, userIdColumn))
    .as("user_todo_activity");
}
