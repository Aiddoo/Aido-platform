import { randomUUID } from "node:crypto";

import { inArray } from "drizzle-orm";
import { chunk } from "es-toolkit";

import type { Database } from "#api/platform/database/database.client";
import {
  nudge,
  todo,
  todoComment,
  todoCommentLike,
  todoItem,
  todoSeries,
  todoView,
} from "#api/platform/database/schema/index";
import { createEntityId } from "#api/shared/domain/model/entity-id";

// 한 문장의 바인딩 값은 65,535개까지라 묶어서 넣는다
const INSERT_BATCH_SIZE = 1000;
const SEOUL = "Asia/Seoul";
const SEEDED_AT = Temporal.Instant.from("2026-01-01T00:00:00Z");

export interface CategoryTodosSeed {
  readonly userId: string;
  readonly categoryId: number;
  /** 댓글·조회·찌르기를 남기는 다른 사용자 */
  readonly friendId: string;
  readonly todoCount: number;
  readonly seriesCount: number;
  /** 첫 할 일 날짜. 리마인더가 미래에 남도록 먼 날짜를 준다 */
  readonly startDate: string;
}

export interface SeededCategoryTodos {
  readonly todoIds: readonly number[];
  readonly scheduledTodos: readonly {
    readonly todoId: number;
    readonly scheduledTime: Temporal.Instant;
  }[];
  readonly seriesIds: readonly string[];
}

async function insertInBatches<TRow>(
  rows: readonly TRow[],
  insert: (batch: TRow[]) => Promise<unknown>,
): Promise<void> {
  for (const batch of chunk([...rows], INSERT_BATCH_SIZE)) {
    await insert(batch);
  }
}

/**
 * 카테고리 하나를 채운다. 짝수 번째 할 일은 서울 10:00 시각이 있고 셋 중 하나는 완료다.
 * 앞쪽 할 일은 진행 중 반복 규칙의 회차이고, 모든 할 일에 하위 항목 2개, 다섯 중 하나에 친구 댓글과
 * 주인의 좋아요, 둘 중 하나에 친구 조회, 열 중 하나에 친구 찌르기가 있다.
 */
export async function insertCategoryTodos(
  db: Database,
  seed: CategoryTodosSeed,
): Promise<SeededCategoryTodos> {
  const { userId, categoryId, friendId, todoCount, seriesCount } = seed;
  const startDate = Temporal.PlainDate.from(seed.startDate);
  const seriesIds = Array.from({ length: seriesCount }, () => randomUUID());
  if (seriesIds.length > 0) {
    await db.insert(todoSeries).values(
      seriesIds.map((id) => ({
        id,
        originSeriesId: id,
        userId,
        categoryId,
        title: "규칙",
        timezone: SEOUL,
        repeatFrequency: "DAILY" as const,
        startDate,
        nextOccurrenceDate: startDate.add({ days: 400 }),
        scheduledLocalTime: "10:00",
        updatedAt: SEEDED_AT,
      })),
    );
  }

  const todoRows = Array.from({ length: todoCount }, (_, index) => {
    const position = index + 1;
    const date = startDate.add({ days: position });
    const seriesId = position <= seriesCount * 5 ? seriesIds[index % seriesCount] : undefined;
    const scheduled = position % 2 === 0;
    const completed = position % 3 === 0;
    return {
      userId,
      categoryId,
      title: "할 일",
      startDate: date,
      occurrenceDate: seriesId == null ? null : date,
      seriesId: seriesId ?? null,
      scheduledLocalTime: scheduled ? "10:00" : null,
      scheduledTime: scheduled
        ? date.toZonedDateTime({ timeZone: SEOUL, plainTime: "10:00" }).toInstant()
        : null,
      isAllDay: !scheduled,
      completed,
      completedAt: completed ? SEEDED_AT : null,
      sortOrder: position,
      updatedAt: SEEDED_AT,
    };
  });
  const seeded: { id: number; scheduledTime: Temporal.Instant | null }[] = [];
  await insertInBatches(todoRows, async (batch) => {
    seeded.push(
      ...(await db
        .insert(todo)
        .values(batch)
        .returning({ id: todo.id, scheduledTime: todo.scheduledTime })),
    );
  });
  const todoIds = seeded.map((row) => row.id);

  await insertInBatches(
    todoIds.flatMap((todoId) =>
      [0, 1].map((sortOrder) => ({ todoId, title: "항목", sortOrder, updatedAt: SEEDED_AT })),
    ),
    (batch) => db.insert(todoItem).values(batch),
  );
  const commentRows = todoIds
    .filter((_, index) => index % 5 === 4)
    .map((todoId) => ({
      id: createEntityId(),
      authorId: friendId,
      clientRequestId: randomUUID(),
      content: "응원해요",
      todoId,
      updatedAt: SEEDED_AT,
    }));
  await insertInBatches(commentRows, (batch) => db.insert(todoComment).values(batch));
  await insertInBatches(
    commentRows.map((comment) => ({ commentId: comment.id, userId, updatedAt: SEEDED_AT })),
    (batch) => db.insert(todoCommentLike).values(batch),
  );
  await insertInBatches(
    todoIds.filter((_, index) => index % 2 === 1).map((todoId) => ({ todoId, viewerId: friendId })),
    (batch) => db.insert(todoView).values(batch),
  );
  await insertInBatches(
    todoIds
      .filter((_, index) => index % 10 === 9)
      .map((todoId) => ({ senderId: friendId, receiverId: userId, todoId })),
    (batch) => db.insert(nudge).values(batch),
  );

  return {
    todoIds,
    scheduledTodos: seeded.flatMap((row) =>
      row.scheduledTime == null ? [] : [{ todoId: row.id, scheduledTime: row.scheduledTime }],
    ),
    seriesIds,
  };
}

/** 할 일 id 묶음과 그 하위 행 수. 지운 뒤에도 같은 id로 하위 행이 남았는지 본다 */
export async function countTodoRows(db: Database, todoIds: readonly number[]) {
  const ids = [...todoIds];
  return {
    todos: await db.$count(todo, inArray(todo.id, ids)),
    items: await db.$count(todoItem, inArray(todoItem.todoId, ids)),
    comments: await db.$count(todoComment, inArray(todoComment.todoId, ids)),
    views: await db.$count(todoView, inArray(todoView.todoId, ids)),
    nudges: await db.$count(nudge, inArray(nudge.todoId, ids)),
  };
}
