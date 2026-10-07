import { TODO_COMMENT_LIMITS, TODO_COMMENT_SORT } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, or } from "@prisma/orm-postgres/orm-client";
import sql, { join } from "sql-template-tag";
import { z } from "zod";

import type { DatabaseRecord } from "#api/platform/database/database-records";
import { decodeRecord } from "#api/platform/database/database-records";
import { decodeSqlRows, sqlRowSpec, sqlStatement } from "#api/platform/database/database-sql";
import { requireRecord } from "#api/platform/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import { toISOString, toISOStringOrNull } from "#api/shared/domain/date/utils/format";

import type {
  ListTodoCommentOverviewParams,
  ListTodoConversationParams,
  TodoCommentOverviewRootRecord,
  TodoCommentOverviewWindow,
  TodoCommentParticipantAuthorRecord,
  TodoCommentRecord,
  TodoConversationRecord,
  TodoConversationWindow,
  TodoDetailsRecord,
} from "../../../application/models/comments/todo-comment.types.js";
import type { TodoCommentReaderPort } from "../../../application/ports/comments/todo-comment.reader.port.js";
import { buildTodoConversationTreeCtes } from "./todo-conversation-tree.sql.js";
import { toTodoResponse } from "./todo-details.mapper.js";

type ProfileUser = DatabaseRecord<"User"> & { profile: DatabaseRecord<"UserProfile"> | null };
type CommentRow = DatabaseRecord<"TodoComment"> & {
  author: ProfileUser | null;
  parent: (DatabaseRecord<"TodoComment"> & { author: ProfileUser | null }) | null;
  todo: { userId: string } | null;
};

interface ConversationQueryRow {
  marker: "PAGE" | "PREVIOUS" | "NEXT" | "BEFORE" | "FOCUS" | "AFTER";
  commentId: string | null;
  todoId: number | null;
  parentId: string | null;
  rootId: string | null;
  path: readonly string[] | null;
  depth: number | null;
  authorId: string | null;
  authorName: string | null;
  authorProfileImage: string | null;
  parentAuthorName: string | null;
  todoOwnerId: string | null;
  content: string | null;
  likeCount: number | null;
  replyCount: number | null;
  rootLikeCount: number | null;
  rootReplyCount: number | null;
  continuingAncestorDepths: number[] | null;
  deletedAt: Date | null;
  editedAt: Date | null;
  createdAt: Date | null;
}

interface OverviewRootQueryRow {
  marker: "PAGE" | "PREVIOUS" | "NEXT";
  commentId: string | null;
  todoId: number | null;
  parentId: string | null;
  rootId: string | null;
  path: readonly string[] | null;
  depth: number | null;
  authorId: string | null;
  authorName: string | null;
  authorProfileImage: string | null;
  parentAuthorName: string | null;
  todoOwnerId: string | null;
  content: string | null;
  likeCount: number | null;
  replyCount: number | null;
  rootLikeCount: number | null;
  rootReplyCount: number | null;
  deletedAt: Date | null;
  editedAt: Date | null;
  createdAt: Date | null;
}

interface OverviewSummaryQueryRow {
  rootId: string;
  totalCount: bigint;
  previewCommentId: string | null;
  previewTodoId: number | null;
  previewParentId: string | null;
  previewRootId: string | null;
  previewPath: readonly string[] | null;
  previewDepth: number | null;
  previewAuthorId: string | null;
  previewAuthorName: string | null;
  previewAuthorProfileImage: string | null;
  previewParentAuthorName: string | null;
  todoOwnerId: string;
  previewContent: string | null;
  previewLikeCount: number | null;
  previewReplyCount: number | null;
  previewDeletedAt: Date | null;
  previewEditedAt: Date | null;
  previewCreatedAt: Date | null;
  participantAuthorId: string | null;
  participantAuthorName: string | null;
  participantAuthorProfileImage: string | null;
  participantIsTodoOwner: boolean | null;
}

interface OverviewRootWindow {
  items: TodoCommentOverviewRootRecord[];
  previousRecord: TodoCommentOverviewRootRecord | null;
  nextRecord: TodoCommentOverviewRootRecord | null;
  hasPrevious: boolean;
  hasNext: boolean;
}

interface OverviewSummaryRecord {
  previewReply: TodoCommentRecord | null;
  totalCount: number;
  participantAuthors: TodoCommentParticipantAuthorRecord[];
}

function requireValue<T>(value: T | null, field: string): T {
  if (value === null) {
    throw new Error(`댓글 대화 조회 결과에 ${field} 값이 없습니다.`);
  }

  return value;
}

function toSafeCount(value: bigint, field: string): number {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(`댓글 개요 조회 결과의 ${field} 값을 확인해주세요.`);
  }

  return count;
}

function toRecord(row: CommentRow): TodoCommentRecord {
  return {
    id: row.id,
    todoId: row.todoId,
    parentId: row.parentId,
    rootId: row.rootId,
    path: [...row.path],
    depth: row.depth,
    parentAuthorName: row.parent?.author?.profile?.name ?? null,
    authorId: requireValue(row.authorId, "authorId"),
    authorName: row.author?.profile?.name ?? null,
    authorProfileImage: row.author?.profile?.profileImage ?? null,
    todoOwnerId: requireRecord(row.todo).userId,
    content: row.content,
    likeCount: row.likeCount,
    replyCount: row.replyCount,
    deletedAt: toISOStringOrNull(row.deletedAt),
    editedAt: toISOStringOrNull(row.editedAt),
    createdAt: toISOString(row.createdAt),
  };
}

function toConversationRecord(row: ConversationQueryRow): TodoConversationRecord | null {
  if (row.commentId === null) {
    return null;
  }

  return {
    id: row.commentId,
    todoId: requireValue(row.todoId, "todoId"),
    parentId: row.parentId,
    rootId: row.rootId,
    path: [...requireValue(row.path, "path")],
    depth: requireValue(row.depth, "depth"),
    parentAuthorName: row.parentAuthorName,
    authorId: requireValue(row.authorId, "authorId"),
    authorName: row.authorName,
    authorProfileImage: row.authorProfileImage,
    todoOwnerId: requireValue(row.todoOwnerId, "todoOwnerId"),
    content: row.content,
    likeCount: requireValue(row.likeCount, "likeCount"),
    replyCount: requireValue(row.replyCount, "replyCount"),
    conversationPosition: {
      rootLikeCount: requireValue(row.rootLikeCount, "rootLikeCount"),
      rootReplyCount: requireValue(row.rootReplyCount, "rootReplyCount"),
    },
    continuingAncestorDepths: requireValue(
      row.continuingAncestorDepths,
      "continuingAncestorDepths",
    ),
    deletedAt: toISOStringOrNull(row.deletedAt),
    editedAt: toISOStringOrNull(row.editedAt),
    createdAt: toISOString(requireValue(row.createdAt, "createdAt")),
  };
}

function toOverviewRootRecord(row: OverviewRootQueryRow): TodoCommentOverviewRootRecord | null {
  if (row.commentId === null) {
    return null;
  }

  return {
    id: row.commentId,
    todoId: requireValue(row.todoId, "todoId"),
    parentId: row.parentId,
    rootId: row.rootId,
    path: [...requireValue(row.path, "path")],
    depth: requireValue(row.depth, "depth"),
    parentAuthorName: row.parentAuthorName,
    authorId: requireValue(row.authorId, "authorId"),
    authorName: row.authorName,
    authorProfileImage: row.authorProfileImage,
    todoOwnerId: requireValue(row.todoOwnerId, "todoOwnerId"),
    content: row.content,
    likeCount: requireValue(row.likeCount, "likeCount"),
    replyCount: requireValue(row.replyCount, "replyCount"),
    overviewPosition: {
      rootLikeCount: requireValue(row.rootLikeCount, "rootLikeCount"),
      rootReplyCount: requireValue(row.rootReplyCount, "rootReplyCount"),
    },
    deletedAt: toISOStringOrNull(row.deletedAt),
    editedAt: toISOStringOrNull(row.editedAt),
    createdAt: toISOString(requireValue(row.createdAt, "createdAt")),
  };
}

function toOverviewPreviewRecord(row: OverviewSummaryQueryRow): TodoCommentRecord | null {
  if (row.previewCommentId === null) {
    return null;
  }

  return {
    id: row.previewCommentId,
    todoId: requireValue(row.previewTodoId, "previewTodoId"),
    parentId: row.previewParentId,
    rootId: row.previewRootId,
    path: [...requireValue(row.previewPath, "previewPath")],
    depth: requireValue(row.previewDepth, "previewDepth"),
    parentAuthorName: row.previewParentAuthorName,
    authorId: requireValue(row.previewAuthorId, "previewAuthorId"),
    authorName: row.previewAuthorName,
    authorProfileImage: row.previewAuthorProfileImage,
    todoOwnerId: row.todoOwnerId,
    content: row.previewContent,
    likeCount: requireValue(row.previewLikeCount, "previewLikeCount"),
    replyCount: requireValue(row.previewReplyCount, "previewReplyCount"),
    deletedAt: toISOStringOrNull(row.previewDeletedAt),
    editedAt: toISOStringOrNull(row.previewEditedAt),
    createdAt: toISOString(requireValue(row.previewCreatedAt, "previewCreatedAt")),
  };
}

function toParticipantAuthor(
  row: OverviewSummaryQueryRow,
): TodoCommentParticipantAuthorRecord | null {
  if (row.participantAuthorId === null) {
    return null;
  }

  return {
    id: row.participantAuthorId,
    name: row.participantAuthorName,
    profileImage: row.participantAuthorProfileImage,
    isTodoOwner: row.participantIsTodoOwner ?? false,
  };
}

@Injectable()
export class PrismaTodoCommentReader implements TodoCommentReaderPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  private get client() {
    return this.txHost.tx;
  }

  private async isAcceptedFriend(firstUserId: string, secondUserId: string): Promise<boolean> {
    const friendship = decodeRecord(
      "Follow",
      await this.client.orm.public.Follow.where((row) =>
        and(
          row.status.eq("ACCEPTED"),
          or(
            and(row.followerId.eq(firstUserId), row.followingId.eq(secondUserId)),
            and(row.followerId.eq(secondUserId), row.followingId.eq(firstUserId)),
          ),
        ),
      )
        .select("id")
        .first(),
    );

    return friendship !== null;
  }

  async canAccessTodo(todoId: number, viewerId: string): Promise<boolean> {
    const todo = decodeRecord(
      "Todo",
      await this.client.orm.public.Todo.where((row) => row.id.eq(todoId))
        .select("userId", "visibility")
        .first(),
    );

    if (todo === null) {
      return false;
    }

    if (todo.userId === viewerId) {
      return true;
    }

    if (todo.visibility !== "PUBLIC") {
      return false;
    }

    return this.isAcceptedFriend(todo.userId, viewerId);
  }

  async findAccessibleTodoDetails(
    todoId: number,
    viewerId: string,
  ): Promise<TodoDetailsRecord | null> {
    const row = decodeRecord(
      "Todo",
      await this.client.orm.public.Todo.where({ id: todoId })
        .include("category")
        .include("items", (items) =>
          items.orderBy((item) => item.sortOrder.asc()).orderBy((item) => item.id.asc()),
        )
        .include("user", (user) => user.include("profile"))
        .first(),
    );
    if (row === null) return null;
    const isOwner = row.userId === viewerId;
    const canAccess =
      isOwner ||
      (row.visibility === "PUBLIC" && (await this.isAcceptedFriend(row.userId, viewerId)));
    if (!canAccess) return null;
    const owner = requireRecord(row.user);
    return {
      todo: toTodoResponse(row),
      owner: {
        id: owner.id,
        name: owner.profile?.name ?? null,
        profileImage: owner.profile?.profileImage ?? null,
      },
      viewCount: row.viewCount,
      commentCount: row.commentCount,
      isOwner,
    };
  }

  async findCommentRecord(todoId: number, commentId: string): Promise<TodoCommentRecord | null> {
    const row = decodeRecord(
      "TodoComment",
      await this.client.orm.public.TodoComment.where((row) =>
        and(row.id.eq(commentId), row.todoId.eq(todoId)),
      )
        .include("author", (related) => related.include("profile"))
        .include("parent", (related) =>
          related.include("author", (related) => related.include("profile")),
        )
        .include("todo", (related) => related.select("userId"))
        .first(),
    );

    return row ? toRecord(row) : null;
  }

  async findCommentRecords(
    todoId: number,
    commentIds: readonly string[],
  ): Promise<TodoCommentRecord[]> {
    if (commentIds.length === 0) {
      return [];
    }

    const rows = decodeRecord(
      "TodoComment",
      await this.client.orm.public.TodoComment.where((row) =>
        and(row.todoId.eq(todoId), row.id.in([...commentIds])),
      )
        .include("author", (related) => related.include("profile"))
        .include("parent", (related) =>
          related.include("author", (related) => related.include("profile")),
        )
        .include("todo", (related) => related.select("userId"))
        .all(),
    );
    const rowsById = new Map(rows.map((row) => [row.id, row]));

    return commentIds.flatMap((commentId) => {
      const row = rowsById.get(commentId);
      return row ? [toRecord(row)] : [];
    });
  }

  /** Overview는 root keyset과 선택된 root들의 descendant aggregate를 각각 한 번만 읽는다. */
  async listOverview(
    params: ListTodoCommentOverviewParams,
  ): Promise<TodoCommentOverviewWindow | null> {
    const rootWindow = await this.listOverviewRoots(params);
    if (rootWindow === null) {
      return null;
    }

    const summaries = await this.findOverviewSummaries(
      params.todoId,
      rootWindow.items.map((record) => record.id),
    );

    return {
      items: rootWindow.items.map((comment) => {
        const summary = summaries.get(comment.id);
        return {
          comment,
          previewReply: summary?.previewReply ?? null,
          totalCount: summary?.totalCount ?? 0,
          participantAuthors: summary?.participantAuthors ?? [],
        };
      }),
      previousRecord: rootWindow.previousRecord,
      nextRecord: rootWindow.nextRecord,
      hasPrevious: rootWindow.hasPrevious,
      hasNext: rootWindow.hasNext,
    };
  }

  private async listOverviewRoots(
    params: ListTodoCommentOverviewParams,
  ): Promise<OverviewRootWindow | null> {
    const sqlRows1 = sqlRowSpec({
      marker: "pg/text@1",
      commentId: { codecId: "pg/text@1", nullable: true },
      todoId: { codecId: "pg/int4@1", nullable: true },
      parentId: { codecId: "pg/text@1", nullable: true },
      rootId: { codecId: "pg/text@1", nullable: true },
      path: { codecId: "pg/json@1", nullable: true },
      depth: { codecId: "pg/int4@1", nullable: true },
      authorId: { codecId: "pg/text@1", nullable: true },
      authorName: { codecId: "pg/text@1", nullable: true },
      authorProfileImage: { codecId: "pg/text@1", nullable: true },
      parentAuthorName: { codecId: "pg/text@1", nullable: true },
      todoOwnerId: { codecId: "pg/text@1", nullable: true },
      content: { codecId: "pg/text@1", nullable: true },
      likeCount: { codecId: "pg/int4@1", nullable: true },
      replyCount: { codecId: "pg/int4@1", nullable: true },
      rootLikeCount: { codecId: "pg/int4@1", nullable: true },
      rootReplyCount: { codecId: "pg/int4@1", nullable: true },
      deletedAt: { codecId: "pg/timestamp-string@1", nullable: true },
      editedAt: { codecId: "pg/timestamp-string@1", nullable: true },
      createdAt: { codecId: "pg/timestamp-string@1", nullable: true },
    });

    const isCursorPage = params.mode === "AFTER" || params.mode === "BEFORE";
    if (
      isCursorPage &&
      (params.anchorRootId === undefined || params.anchorPosition === undefined)
    ) {
      return null;
    }

    const boundaryLikeCount =
      params.anchorPosition === undefined
        ? sql`anchor."likeCount"`
        : sql`${params.anchorPosition.rootLikeCount}`;
    const boundaryReplyCount =
      params.anchorPosition === undefined
        ? sql`anchor."replyCount"`
        : sql`${params.anchorPosition.rootReplyCount}`;
    const rootOrder =
      params.sort === TODO_COMMENT_SORT.LATEST
        ? sql`candidate."createdAt" DESC, candidate."id" DESC`
        : sql`candidate."likeCount" DESC, candidate."replyCount" DESC, candidate."createdAt" DESC, candidate."id" DESC`;
    const reverseRootOrder =
      params.sort === TODO_COMMENT_SORT.LATEST
        ? sql`candidate."createdAt" ASC, candidate."id" ASC`
        : sql`candidate."likeCount" ASC, candidate."replyCount" ASC, candidate."createdAt" ASC, candidate."id" ASC`;
    const selectedOrder =
      params.sort === TODO_COMMENT_SORT.LATEST
        ? sql`selected."createdAt" DESC, selected."id" DESC`
        : sql`selected."likeCount" DESC, selected."replyCount" DESC, selected."createdAt" DESC, selected."id" DESC`;
    const afterAnchor =
      params.sort === TODO_COMMENT_SORT.LATEST
        ? sql`
					ROW(candidate."createdAt", candidate."id")
						< ROW(anchor."createdAt", anchor."id")
				`
        : sql`
					ROW(
						candidate."likeCount",
						candidate."replyCount",
						candidate."createdAt",
						candidate."id"
					) < ROW(
						${boundaryLikeCount},
						${boundaryReplyCount},
						anchor."createdAt",
						anchor."id"
					)
				`;
    const beforeAnchor =
      params.sort === TODO_COMMENT_SORT.LATEST
        ? sql`
					ROW(candidate."createdAt", candidate."id")
						> ROW(anchor."createdAt", anchor."id")
				`
        : sql`
					ROW(
						candidate."likeCount",
						candidate."replyCount",
						candidate."createdAt",
						candidate."id"
					) > ROW(
						${boundaryLikeCount},
						${boundaryReplyCount},
						anchor."createdAt",
						anchor."id"
					)
				`;
    const anchorCte = sql`
			anchor AS (
				SELECT comment.*
				FROM "TodoComment" AS comment
				WHERE comment."todoId" = ${params.todoId}
					AND comment."id" = ${params.anchorRootId ?? null}::TEXT
					AND comment."parentId" IS NULL
			)
		`;
    const selectionCte = (() => {
      if (params.mode === "INITIAL") {
        return sql`
					selected AS (
						SELECT candidate.*, 'PAGE'::TEXT AS "marker"
						FROM "TodoComment" AS candidate
						WHERE candidate."todoId" = ${params.todoId}
							AND candidate."parentId" IS NULL
							AND (candidate."deletedAt" IS NULL OR candidate."replyCount" > 0)
						ORDER BY ${rootOrder}
						LIMIT ${params.size + 1}
					)
				`;
      }

      if (params.mode === "AFTER") {
        return sql`
					${anchorCte},
					selected AS (
						(
							SELECT candidate.*, 'PAGE'::TEXT AS "marker"
							FROM "TodoComment" AS candidate
							CROSS JOIN anchor
							WHERE candidate."todoId" = ${params.todoId}
								AND candidate."parentId" IS NULL
								AND (candidate."deletedAt" IS NULL OR candidate."replyCount" > 0)
								AND (${afterAnchor})
							ORDER BY ${rootOrder}
							LIMIT ${params.size + 1}
						)
						UNION ALL
						SELECT anchor.*, 'PREVIOUS'::TEXT AS "marker" FROM anchor
					)
				`;
      }

      return sql`
				${anchorCte},
				selected AS (
					(
						SELECT candidate.*, 'PAGE'::TEXT AS "marker"
						FROM "TodoComment" AS candidate
						CROSS JOIN anchor
						WHERE candidate."todoId" = ${params.todoId}
							AND candidate."parentId" IS NULL
							AND (candidate."deletedAt" IS NULL OR candidate."replyCount" > 0)
							AND (${beforeAnchor})
						ORDER BY ${reverseRootOrder}
						LIMIT ${params.size + 1}
					)
					UNION ALL
					SELECT anchor.*, 'NEXT'::TEXT AS "marker" FROM anchor
				)
			`;
    })();

    const rows = decodeSqlRows(
      sqlRows1,
      await this.client.query(
        sqlStatement(
          this.client,
          sql`
			WITH ${selectionCte}
			SELECT
				selected."marker",
				selected."id" AS "commentId",
				selected."todoId",
				selected."parentId",
				selected."rootId",
				to_json(selected."path") AS "path",
				selected."depth",
				selected."authorId",
				author_profile."name" AS "authorName",
				author_profile."profileImage" AS "authorProfileImage",
				NULL::TEXT AS "parentAuthorName",
				todo."userId" AS "todoOwnerId",
				selected."content",
				selected."likeCount",
				selected."replyCount",
				selected."likeCount" AS "rootLikeCount",
				selected."replyCount" AS "rootReplyCount",
				selected."deletedAt",
				selected."editedAt",
				selected."createdAt"
			FROM selected
			INNER JOIN "Todo" AS todo ON todo."id" = selected."todoId"
			LEFT JOIN "UserProfile" AS author_profile ON author_profile."userId" = selected."authorId"
			ORDER BY ${selectedOrder}
		`,
        )
          .returnsRow(sqlRows1)
          .build(),
      ),
    ).map((row) => ({
      ...row,
      marker: z.enum(["PAGE", "PREVIOUS", "NEXT"]).parse(row["marker"]),
      path: z.array(z.string()).nullable().parse(row.path),
    }));

    if (isCursorPage && rows.length === 0) {
      return null;
    }

    const markedRecords = rows.flatMap((row) => {
      const record = toOverviewRootRecord(row);
      return record === null ? [] : [{ marker: row.marker, record }];
    });
    return this.toOverviewRootWindow(markedRecords, params);
  }

  private toOverviewRootWindow(
    markedRecords: readonly {
      marker: OverviewRootQueryRow["marker"];
      record: TodoCommentOverviewRootRecord;
    }[],
    params: ListTodoCommentOverviewParams,
  ): OverviewRootWindow {
    const pageCandidates = markedRecords
      .filter(({ marker }) => marker === "PAGE")
      .map(({ record }) => record);

    if (params.mode === "BEFORE") {
      const hasPrevious = pageCandidates.length > params.size;
      const items = hasPrevious ? pageCandidates.slice(-params.size) : pageCandidates;
      return {
        items,
        previousRecord: hasPrevious ? (pageCandidates.at(-params.size - 1) ?? null) : null,
        nextRecord: markedRecords.find(({ marker }) => marker === "NEXT")?.record ?? null,
        hasPrevious: items.length > 0 && hasPrevious,
        hasNext: items.length > 0,
      };
    }

    const hasNext = pageCandidates.length > params.size;
    const items = hasNext ? pageCandidates.slice(0, params.size) : pageCandidates;
    return {
      items,
      previousRecord:
        params.mode === "AFTER"
          ? (markedRecords.find(({ marker }) => marker === "PREVIOUS")?.record ?? null)
          : null,
      nextRecord: hasNext ? (pageCandidates[params.size] ?? null) : null,
      hasPrevious: items.length > 0 && params.mode === "AFTER",
      hasNext: items.length > 0 && hasNext,
    };
  }

  private async findOverviewSummaries(
    todoId: number,
    rootIds: readonly string[],
  ): Promise<Map<string, OverviewSummaryRecord>> {
    const sqlRows2 = sqlRowSpec({
      rootId: "pg/text@1",
      totalCount: "pg/int8@1",
      previewCommentId: { codecId: "pg/text@1", nullable: true },
      previewTodoId: { codecId: "pg/int4@1", nullable: true },
      previewParentId: { codecId: "pg/text@1", nullable: true },
      previewRootId: { codecId: "pg/text@1", nullable: true },
      previewPath: { codecId: "pg/json@1", nullable: true },
      previewDepth: { codecId: "pg/int4@1", nullable: true },
      previewAuthorId: { codecId: "pg/text@1", nullable: true },
      previewAuthorName: { codecId: "pg/text@1", nullable: true },
      previewAuthorProfileImage: { codecId: "pg/text@1", nullable: true },
      previewParentAuthorName: { codecId: "pg/text@1", nullable: true },
      todoOwnerId: "pg/text@1",
      previewContent: { codecId: "pg/text@1", nullable: true },
      previewLikeCount: { codecId: "pg/int4@1", nullable: true },
      previewReplyCount: { codecId: "pg/int4@1", nullable: true },
      previewDeletedAt: { codecId: "pg/timestamp-string@1", nullable: true },
      previewEditedAt: { codecId: "pg/timestamp-string@1", nullable: true },
      previewCreatedAt: { codecId: "pg/timestamp-string@1", nullable: true },
      participantAuthorId: { codecId: "pg/text@1", nullable: true },
      participantAuthorName: { codecId: "pg/text@1", nullable: true },
      participantAuthorProfileImage: { codecId: "pg/text@1", nullable: true },
      participantIsTodoOwner: { codecId: "pg/bool@1", nullable: true },
    });

    if (rootIds.length === 0) {
      return new Map();
    }

    const rootIdList = join(rootIds);
    const rows = decodeSqlRows(
      sqlRows2,
      await this.client.query(
        sqlStatement(
          this.client,
          sql`
			WITH RECURSIVE requested_roots AS (
				SELECT requested."rootId", requested."ordinal"
				FROM unnest(ARRAY[${rootIdList}]::TEXT[])
					WITH ORDINALITY AS requested("rootId", "ordinal")
			),
			descendant_tree AS (
				SELECT
					child.*,
					requested."rootId" AS "threadId",
					ARRAY[
						lpad(((extract(epoch FROM child."createdAt") * 1000000)::BIGINT)::TEXT, 20, '0') || ':' || child."id"
					]::TEXT[] AS "dfsPath"
				FROM requested_roots AS requested
				INNER JOIN "TodoComment" AS child ON child."parentId" = requested."rootId"
				WHERE child."todoId" = ${todoId}

				UNION ALL

				SELECT
					child.*,
					parent."threadId",
					parent."dfsPath" || ARRAY[
						lpad(((extract(epoch FROM child."createdAt") * 1000000)::BIGINT)::TEXT, 20, '0') || ':' || child."id"
					]::TEXT[]
				FROM "TodoComment" AS child
				INNER JOIN descendant_tree AS parent ON parent."id" = child."parentId"
				WHERE child."todoId" = ${todoId}
			),
			visible_summary AS (
				SELECT descendant."threadId", COUNT(*)::BIGINT AS "totalCount"
				FROM descendant_tree AS descendant
				WHERE descendant."deletedAt" IS NULL OR descendant."replyCount" > 0
				GROUP BY descendant."threadId"
			),
			preview_ranked AS (
				SELECT
					descendant.*,
					ROW_NUMBER() OVER (
						PARTITION BY descendant."threadId"
						ORDER BY
							(descendant."authorId" = todo."userId") DESC,
							descendant."createdAt" ASC,
							descendant."id" ASC
					) AS "previewRank"
				FROM descendant_tree AS descendant
				INNER JOIN "Todo" AS todo ON todo."id" = descendant."todoId"
				WHERE descendant."parentId" = descendant."threadId"
					AND descendant."deletedAt" IS NULL
			),
			preview AS (
				SELECT * FROM preview_ranked WHERE "previewRank" = 1
			),
			author_first_ranked AS (
				SELECT
					descendant.*,
					ROW_NUMBER() OVER (
						PARTITION BY descendant."threadId", descendant."authorId"
						ORDER BY descendant."dfsPath" ASC
					) AS "authorAppearanceRank"
				FROM descendant_tree AS descendant
				WHERE descendant."deletedAt" IS NULL
					AND descendant."authorId" IS NOT NULL
			),
			author_first AS (
				SELECT * FROM author_first_ranked WHERE "authorAppearanceRank" = 1
			),
			participant_ranked AS (
				SELECT
					author_first.*,
					ROW_NUMBER() OVER (
						PARTITION BY author_first."threadId"
						ORDER BY
							(author_first."authorId" = todo."userId") DESC,
							author_first."dfsPath" ASC,
							author_first."authorId" ASC
					) AS "participantRank"
				FROM author_first
				INNER JOIN "Todo" AS todo ON todo."id" = author_first."todoId"
			),
			participants AS (
				SELECT * FROM participant_ranked
				WHERE "participantRank" <= ${TODO_COMMENT_LIMITS.OVERVIEW_PARTICIPANT_MAX_SIZE}
			)
			SELECT
				requested."rootId",
				COALESCE(summary."totalCount", 0)::BIGINT AS "totalCount",
				preview."id" AS "previewCommentId",
				preview."todoId" AS "previewTodoId",
				preview."parentId" AS "previewParentId",
				preview."rootId" AS "previewRootId",
				to_json(preview."path") AS "previewPath",
				preview."depth" AS "previewDepth",
				preview."authorId" AS "previewAuthorId",
				preview_author_profile."name" AS "previewAuthorName",
				preview_author_profile."profileImage" AS "previewAuthorProfileImage",
				preview_parent_profile."name" AS "previewParentAuthorName",
				todo."userId" AS "todoOwnerId",
				preview."content" AS "previewContent",
				preview."likeCount" AS "previewLikeCount",
				preview."replyCount" AS "previewReplyCount",
				preview."deletedAt" AS "previewDeletedAt",
				preview."editedAt" AS "previewEditedAt",
				preview."createdAt" AS "previewCreatedAt",
				participant."authorId" AS "participantAuthorId",
				participant_profile."name" AS "participantAuthorName",
				participant_profile."profileImage" AS "participantAuthorProfileImage",
				(participant."authorId" = todo."userId") AS "participantIsTodoOwner"
			FROM requested_roots AS requested
			INNER JOIN "Todo" AS todo ON todo."id" = ${todoId}
			LEFT JOIN visible_summary AS summary ON summary."threadId" = requested."rootId"
			LEFT JOIN preview ON preview."threadId" = requested."rootId"
			LEFT JOIN "UserProfile" AS preview_author_profile
				ON preview_author_profile."userId" = preview."authorId"
			LEFT JOIN "TodoComment" AS preview_parent ON preview_parent."id" = preview."parentId"
			LEFT JOIN "UserProfile" AS preview_parent_profile
				ON preview_parent_profile."userId" = preview_parent."authorId"
			LEFT JOIN participants AS participant ON participant."threadId" = requested."rootId"
			LEFT JOIN "UserProfile" AS participant_profile
				ON participant_profile."userId" = participant."authorId"
			ORDER BY requested."ordinal" ASC, participant."participantRank" ASC NULLS LAST
		`,
        )
          .returnsRow(sqlRows2)
          .build(),
      ),
    ).map((row) => ({
      ...row,
      previewPath: z.array(z.string()).nullable().parse(row.previewPath),
    }));

    const summaries = new Map<string, OverviewSummaryRecord>();
    for (const row of rows) {
      const existing = summaries.get(row.rootId);
      const participant = toParticipantAuthor(row);

      if (existing === undefined) {
        summaries.set(row.rootId, {
          previewReply: toOverviewPreviewRecord(row),
          totalCount: toSafeCount(row.totalCount, "totalCount"),
          participantAuthors: participant === null ? [] : [participant],
        });
        continue;
      }

      if (participant !== null) {
        existing.participantAuthors.push(participant);
      }
    }

    return summaries;
  }

  /**
   * root block은 최신/인기순으로, block 안은 형제 createdAt/id 오름차순 DFS로 세운다.
   * 재귀 CTE가 만든 DFS key를 keyset 비교하고, 경계 앞뒤 한 행만 더 읽어 rail 연속성도 확정한다.
   */
  async listConversation(
    params: ListTodoConversationParams,
  ): Promise<TodoConversationWindow | null> {
    const sqlRows3 = sqlRowSpec({
      marker: "pg/text@1",
      commentId: { codecId: "pg/text@1", nullable: true },
      todoId: { codecId: "pg/int4@1", nullable: true },
      parentId: { codecId: "pg/text@1", nullable: true },
      rootId: { codecId: "pg/text@1", nullable: true },
      path: { codecId: "pg/json@1", nullable: true },
      depth: { codecId: "pg/int4@1", nullable: true },
      authorId: { codecId: "pg/text@1", nullable: true },
      authorName: { codecId: "pg/text@1", nullable: true },
      authorProfileImage: { codecId: "pg/text@1", nullable: true },
      parentAuthorName: { codecId: "pg/text@1", nullable: true },
      todoOwnerId: { codecId: "pg/text@1", nullable: true },
      content: { codecId: "pg/text@1", nullable: true },
      likeCount: { codecId: "pg/int4@1", nullable: true },
      replyCount: { codecId: "pg/int4@1", nullable: true },
      rootLikeCount: { codecId: "pg/int4@1", nullable: true },
      rootReplyCount: { codecId: "pg/int4@1", nullable: true },
      continuingAncestorDepths: { codecId: "pg/json@1", nullable: true },
      deletedAt: { codecId: "pg/timestamp-string@1", nullable: true },
      editedAt: { codecId: "pg/timestamp-string@1", nullable: true },
      createdAt: { codecId: "pg/timestamp-string@1", nullable: true },
    });

    const isCursorPage = params.mode === "AFTER" || params.mode === "BEFORE";
    if (
      isCursorPage &&
      (params.anchorCommentId === undefined ||
        params.anchorThreadId === undefined ||
        params.anchorPosition === undefined)
    ) {
      return null;
    }

    const snapshotBoundary =
      params.anchorPosition === undefined
        ? null
        : {
            position: params.anchorPosition,
            threadId: requireValue(params.anchorThreadId ?? null, "anchorThreadId"),
          };
    const boundaryThreadId = sql`anchor."threadId"`;
    const boundaryRootLikeCount =
      snapshotBoundary === null
        ? sql`anchor."rootLikeCount"`
        : sql`${snapshotBoundary.position.rootLikeCount}`;
    const boundaryRootReplyCount =
      snapshotBoundary === null
        ? sql`anchor."rootReplyCount"`
        : sql`${snapshotBoundary.position.rootReplyCount}`;
    const boundaryRootCreatedAt = sql`anchor."rootCreatedAt"`;
    const boundaryDfsPath = sql`anchor."dfsPath"`;
    const cursorScopeCondition =
      params.scope === "THREAD" ? sql`candidate."threadId" = anchor."threadId"` : sql`TRUE`;
    const focusAnchorVisibilityCondition =
      params.mode === "FOCUS"
        ? sql`(tree."deletedAt" IS NULL OR tree."replyCount" > 0)`
        : sql`TRUE`;
    const candidateRootLikeCountAtBoundary =
      snapshotBoundary === null
        ? sql`candidate."rootLikeCount"`
        : sql`
				CASE
					WHEN candidate."threadId" = ${snapshotBoundary.threadId}::TEXT
						THEN ${snapshotBoundary.position.rootLikeCount}
					ELSE candidate."rootLikeCount"
				END
			`;
    const candidateRootReplyCountAtBoundary =
      snapshotBoundary === null
        ? sql`candidate."rootReplyCount"`
        : sql`
				CASE
					WHEN candidate."threadId" = ${snapshotBoundary.threadId}::TEXT
						THEN ${snapshotBoundary.position.rootReplyCount}
					ELSE candidate."rootReplyCount"
				END
			`;
    const selectedRootLikeCountAtBoundary =
      snapshotBoundary === null
        ? sql`selected."rootLikeCount"`
        : sql`
				CASE
					WHEN selected."threadId" = ${snapshotBoundary.threadId}::TEXT
						THEN ${snapshotBoundary.position.rootLikeCount}
					ELSE selected."rootLikeCount"
				END
			`;
    const selectedRootReplyCountAtBoundary =
      snapshotBoundary === null
        ? sql`selected."rootReplyCount"`
        : sql`
				CASE
					WHEN selected."threadId" = ${snapshotBoundary.threadId}::TEXT
						THEN ${snapshotBoundary.position.rootReplyCount}
					ELSE selected."rootReplyCount"
				END
			`;
    const candidateOrder =
      params.sort === TODO_COMMENT_SORT.LATEST
        ? sql`candidate."rootCreatedAt" DESC, candidate."threadId" DESC, candidate."dfsPath" ASC`
        : sql`${candidateRootLikeCountAtBoundary} DESC, ${candidateRootReplyCountAtBoundary} DESC, candidate."rootCreatedAt" DESC, candidate."threadId" DESC, candidate."dfsPath" ASC`;
    const reverseCandidateOrder =
      params.sort === TODO_COMMENT_SORT.LATEST
        ? sql`candidate."rootCreatedAt" ASC, candidate."threadId" ASC, candidate."dfsPath" DESC`
        : sql`${candidateRootLikeCountAtBoundary} ASC, ${candidateRootReplyCountAtBoundary} ASC, candidate."rootCreatedAt" ASC, candidate."threadId" ASC, candidate."dfsPath" DESC`;
    const selectedOrder =
      params.sort === TODO_COMMENT_SORT.LATEST
        ? sql`selected."rootCreatedAt" DESC, selected."threadId" DESC, selected."dfsPath" ASC`
        : sql`${selectedRootLikeCountAtBoundary} DESC, ${selectedRootReplyCountAtBoundary} DESC, selected."rootCreatedAt" DESC, selected."threadId" DESC, selected."dfsPath" ASC`;
    const afterAnchor =
      params.sort === TODO_COMMENT_SORT.LATEST
        ? sql`
					(
						candidate."threadId" <> ${boundaryThreadId}
						AND ROW(candidate."rootCreatedAt", candidate."threadId")
							< ROW(${boundaryRootCreatedAt}, ${boundaryThreadId})
					)
					OR (
						candidate."threadId" = ${boundaryThreadId}
						AND candidate."dfsPath" > ${boundaryDfsPath}
					)
				`
        : sql`
					(
						candidate."threadId" <> ${boundaryThreadId}
						AND ROW(
							candidate."rootLikeCount",
							candidate."rootReplyCount",
							candidate."rootCreatedAt",
							candidate."threadId"
						) < ROW(
							${boundaryRootLikeCount},
							${boundaryRootReplyCount},
							${boundaryRootCreatedAt},
							${boundaryThreadId}
						)
					)
					OR (
						candidate."threadId" = ${boundaryThreadId}
						AND candidate."dfsPath" > ${boundaryDfsPath}
					)
				`;
    const beforeAnchor =
      params.sort === TODO_COMMENT_SORT.LATEST
        ? sql`
					(
						candidate."threadId" <> ${boundaryThreadId}
						AND ROW(candidate."rootCreatedAt", candidate."threadId")
							> ROW(${boundaryRootCreatedAt}, ${boundaryThreadId})
					)
					OR (
						candidate."threadId" = ${boundaryThreadId}
						AND candidate."dfsPath" < ${boundaryDfsPath}
					)
				`
        : sql`
					(
						candidate."threadId" <> ${boundaryThreadId}
						AND ROW(
							candidate."rootLikeCount",
							candidate."rootReplyCount",
							candidate."rootCreatedAt",
							candidate."threadId"
						) > ROW(
							${boundaryRootLikeCount},
							${boundaryRootReplyCount},
							${boundaryRootCreatedAt},
							${boundaryThreadId}
						)
					)
					OR (
						candidate."threadId" = ${boundaryThreadId}
						AND candidate."dfsPath" < ${boundaryDfsPath}
					)
				`;
    const anchorCte = sql`
			anchor AS (
				SELECT tree.*
				FROM tree
				WHERE tree."id" = ${params.anchorCommentId ?? null}::TEXT
					AND (${focusAnchorVisibilityCondition})
					AND (
						${params.anchorThreadId ?? null}::TEXT IS NULL
						OR tree."threadId" = ${params.anchorThreadId ?? null}::TEXT
					)
			)
		`;
    const selectionCte = (() => {
      if (params.mode === "INITIAL") {
        return sql`
					selected AS (
						SELECT candidate.*, 'PAGE'::TEXT AS "marker"
						FROM tree AS candidate
						WHERE candidate."deletedAt" IS NULL OR candidate."replyCount" > 0
						ORDER BY ${candidateOrder}
						LIMIT ${params.size + 1}
					)
				`;
      }

      if (params.mode === "AFTER") {
        return sql`
					${anchorCte},
					selected AS (
						(
							SELECT candidate.*, 'PAGE'::TEXT AS "marker"
							FROM tree AS candidate
							CROSS JOIN anchor
							WHERE (candidate."deletedAt" IS NULL OR candidate."replyCount" > 0)
								AND (${cursorScopeCondition})
								AND (${afterAnchor})
							ORDER BY ${candidateOrder}
							LIMIT ${params.size + 1}
						)
						UNION ALL
						SELECT anchor.*, 'PREVIOUS'::TEXT AS "marker" FROM anchor
					)
				`;
      }

      if (params.mode === "BEFORE") {
        return sql`
					${anchorCte},
					selected AS (
						(
							SELECT candidate.*, 'PAGE'::TEXT AS "marker"
							FROM tree AS candidate
							CROSS JOIN anchor
							WHERE (candidate."deletedAt" IS NULL OR candidate."replyCount" > 0)
								AND (${cursorScopeCondition})
								AND (${beforeAnchor})
							ORDER BY ${reverseCandidateOrder}
							LIMIT ${params.size + 1}
						)
						UNION ALL
						SELECT anchor.*, 'NEXT'::TEXT AS "marker" FROM anchor
					)
				`;
      }

      return sql`
				${anchorCte},
				selected AS (
					(
						SELECT candidate.*, 'BEFORE'::TEXT AS "marker"
						FROM tree AS candidate
						CROSS JOIN anchor
							WHERE (candidate."deletedAt" IS NULL OR candidate."replyCount" > 0)
								AND candidate."threadId" = anchor."threadId"
								AND (${beforeAnchor})
						ORDER BY ${reverseCandidateOrder}
						LIMIT ${params.size + 1}
					)
					UNION ALL
					SELECT anchor.*, 'FOCUS'::TEXT AS "marker" FROM anchor
					UNION ALL
					(
						SELECT candidate.*, 'AFTER'::TEXT AS "marker"
						FROM tree AS candidate
						CROSS JOIN anchor
							WHERE (candidate."deletedAt" IS NULL OR candidate."replyCount" > 0)
								AND candidate."threadId" = anchor."threadId"
								AND (${afterAnchor})
						ORDER BY ${candidateOrder}
						LIMIT ${params.size + 1}
					)
				)
			`;
    })();
    const rows = decodeSqlRows(
      sqlRows3,
      await this.client.query(
        sqlStatement(
          this.client,
          sql`
			WITH RECURSIVE ${buildTodoConversationTreeCtes(params)},
			${selectionCte}
			SELECT
				selected."marker",
				selected."id" AS "commentId",
				selected."todoId",
				selected."parentId",
				selected."rootId",
				to_json(selected."path") AS "path",
				selected."depth",
				selected."authorId",
				author_profile."name" AS "authorName",
				author_profile."profileImage" AS "authorProfileImage",
				parent_profile."name" AS "parentAuthorName",
				todo."userId" AS "todoOwnerId",
				selected."content",
				selected."likeCount",
				selected."replyCount",
				${selectedRootLikeCountAtBoundary} AS "rootLikeCount",
				${selectedRootReplyCountAtBoundary} AS "rootReplyCount",
				to_json(selected."continuingAncestorDepths") AS "continuingAncestorDepths",
				selected."deletedAt",
				selected."editedAt",
				selected."createdAt"
			FROM selected
			LEFT JOIN "Todo" AS todo ON todo."id" = selected."todoId"
			LEFT JOIN "UserProfile" AS author_profile ON author_profile."userId" = selected."authorId"
			LEFT JOIN "TodoComment" AS parent_comment ON parent_comment."id" = selected."parentId"
			LEFT JOIN "UserProfile" AS parent_profile ON parent_profile."userId" = parent_comment."authorId"
			ORDER BY ${selectedOrder}
		`,
        )
          .returnsRow(sqlRows3)
          .build(),
      ),
    ).map((row) => ({
      ...row,
      marker: z.enum(["PAGE", "PREVIOUS", "NEXT", "BEFORE", "FOCUS", "AFTER"]).parse(row["marker"]),
      continuingAncestorDepths: z
        .array(z.number().int())
        .nullable()
        .parse(row["continuingAncestorDepths"]),
      path: z.array(z.string()).nullable().parse(row.path),
    }));

    if (params.mode !== "INITIAL" && rows.length === 0) {
      return null;
    }

    const markedRecords = rows.flatMap((row) => {
      const record = toConversationRecord(row);
      return record === null ? [] : [{ marker: row.marker, record }];
    });
    return this.toConversationWindow(markedRecords, params);
  }

  private toConversationWindow(
    markedRecords: readonly {
      marker: ConversationQueryRow["marker"];
      record: TodoConversationRecord;
    }[],
    params: ListTodoConversationParams,
  ): TodoConversationWindow {
    if (params.mode === "FOCUS") {
      return this.toFocusWindow(markedRecords, params.size);
    }

    const pageCandidates = markedRecords
      .filter(({ marker }) => marker === "PAGE")
      .map(({ record }) => record);
    if (params.mode === "BEFORE") {
      const hasPrevious = pageCandidates.length > params.size;
      const items = hasPrevious ? pageCandidates.slice(-params.size) : pageCandidates;
      return {
        items,
        anchorIndex: null,
        previousRecord: hasPrevious ? (pageCandidates.at(-params.size - 1) ?? null) : null,
        nextRecord: markedRecords.find(({ marker }) => marker === "NEXT")?.record ?? null,
        hasPrevious: items.length > 0 && hasPrevious,
        hasNext: items.length > 0,
      };
    }

    const hasNext = pageCandidates.length > params.size;
    const items = hasNext ? pageCandidates.slice(0, params.size) : pageCandidates;
    return {
      items,
      anchorIndex: null,
      previousRecord:
        params.mode === "AFTER"
          ? (markedRecords.find(({ marker }) => marker === "PREVIOUS")?.record ?? null)
          : null,
      nextRecord: hasNext ? (pageCandidates[params.size] ?? null) : null,
      hasPrevious: items.length > 0 && params.mode === "AFTER",
      hasNext: items.length > 0 && hasNext,
    };
  }

  private toFocusWindow(
    markedRecords: readonly {
      marker: ConversationQueryRow["marker"];
      record: TodoConversationRecord;
    }[],
    size: number,
  ): TodoConversationWindow {
    const before = markedRecords
      .filter(({ marker }) => marker === "BEFORE")
      .map(({ record }) => record);
    const after = markedRecords
      .filter(({ marker }) => marker === "AFTER")
      .map(({ record }) => record);
    const focus = markedRecords.find(({ marker }) => marker === "FOCUS")?.record;
    if (focus === undefined) {
      return {
        items: [],
        anchorIndex: null,
        previousRecord: null,
        nextRecord: null,
        hasPrevious: false,
        hasNext: false,
      };
    }

    const desiredBefore = Math.floor(size / 2);
    let beforeCount = Math.min(desiredBefore, before.length);
    let afterCount = Math.min(size - beforeCount - 1, after.length);
    beforeCount = Math.min(before.length, beforeCount + (size - beforeCount - afterCount - 1));
    afterCount = Math.min(after.length, size - beforeCount - 1);
    const selectedBefore = before.slice(-beforeCount);
    const selectedAfter = after.slice(0, afterCount);

    return {
      items: [...selectedBefore, focus, ...selectedAfter],
      anchorIndex: selectedBefore.length,
      previousRecord: before.at(-beforeCount - 1) ?? null,
      nextRecord: after[afterCount] ?? null,
      hasPrevious: before.length > beforeCount,
      hasNext: after.length > afterCount,
    };
  }

  async findAncestors(todoId: number, path: readonly string[]): Promise<TodoCommentRecord[]> {
    return this.findCommentRecords(todoId, path);
  }

  async findLikedCommentIds(commentIds: readonly string[], viewerId: string): Promise<Set<string>> {
    if (commentIds.length === 0) {
      return new Set();
    }

    const likes = decodeRecord(
      "TodoCommentLike",
      await this.client.orm.public.TodoCommentLike.where((row) =>
        and(row.commentId.in([...commentIds]), row.userId.eq(viewerId), row.isActive.eq(true)),
      )
        .select("commentId")
        .all(),
    );

    return new Set(likes.map((like) => like.commentId));
  }

  async findUserDisplayName(userId: string): Promise<string | null> {
    const profile = decodeRecord(
      "UserProfile",
      await this.client.orm.public.UserProfile.where((row) => row.userId.eq(userId))
        .select("name")
        .first(),
    );

    return profile?.name ?? null;
  }
}
