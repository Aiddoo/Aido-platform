import { sql } from "drizzle-orm";
import {
  pgTable,
  integer,
  text,
  char,
  varchar,
  boolean,
  uuid,
  index,
  foreignKey,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";

import { instant } from "../columns/temporal-columns.js";
import { createEntityId } from "../entity-id.js";
import { user } from "./identity.schema.js";
import { todo } from "./planning.schema.js";

export const todoComment = pgTable(
  "TodoComment",
  {
    authorId: text().notNull(),
    clientRequestId: uuid().notNull(),
    content: varchar({ length: 500 }),
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    deletedAt: instant(),
    editedAt: instant(),
    id: text().primaryKey().$defaultFn(createEntityId),
    likeCount: integer().default(0).notNull(),
    parentId: text(),
    replyCount: integer().default(0).notNull(),
    replyToCommentId: text(),
    requestFingerprint: char({ length: 64 }),
    todoId: integer().notNull(),
    // 도메인이 ClockPort 값으로 채운다. 좋아요 끄기 같은 집합 update도 저장소가 명시한다
    updatedAt: instant().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [user.id],
      name: "TodoComment_authorId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: "TodoComment_parentId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.replyToCommentId],
      foreignColumns: [table.id],
      name: "TodoComment_replyToCommentId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    foreignKey({
      columns: [table.todoId],
      foreignColumns: [todo.id],
      name: "TodoComment_todoId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("TodoComment_todoId_parentId_createdAt_id_idx").using(
      "btree",
      table.todoId.asc().nullsLast(),
      table.parentId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
      table.id.asc().nullsLast(),
    ),
    index("TodoComment_todoId_parentId_likeCount_replyCount_createdAt__idx").using(
      "btree",
      table.todoId.asc().nullsLast(),
      table.parentId.asc().nullsLast(),
      table.likeCount.asc().nullsLast(),
      table.replyCount.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
      table.id.asc().nullsLast(),
    ),
    index("TodoComment_parentId_createdAt_id_idx").using(
      "btree",
      table.parentId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
      table.id.asc().nullsLast(),
    ),
    index("TodoComment_replyToCommentId_idx").using(
      "btree",
      table.replyToCommentId.asc().nullsLast(),
    ),
    unique("TodoComment_authorId_clientRequestId_key").on(table.authorId, table.clientRequestId),
  ],
);

export const todoCommentLike = pgTable(
  "TodoCommentLike",
  {
    commentId: text().notNull(),
    createdAt: instant()
      .default(sql`now()`)
      .notNull(),
    isActive: boolean().default(true).notNull(),
    notifiedAt: instant(),
    // 도메인이 ClockPort 값으로 채운다. 좋아요 끄기 같은 집합 update도 저장소가 명시한다
    updatedAt: instant().notNull(),
    userId: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.commentId, table.userId], name: "TodoCommentLike_pkey" }),
    foreignKey({
      columns: [table.commentId],
      foreignColumns: [todoComment.id],
      name: "TodoCommentLike_commentId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "TodoCommentLike_userId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    index("TodoCommentLike_userId_isActive_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.isActive.asc().nullsLast(),
    ),
  ],
);
