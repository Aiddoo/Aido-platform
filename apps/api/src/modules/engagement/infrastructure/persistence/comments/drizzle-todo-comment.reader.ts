import { TODO_COMMENT_LIMITS, TODO_COMMENT_SORT } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo, todoComment, userProfile, user } from "#api/platform/database/schema/index";
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

type CommentRow = typeof todoComment.$inferSelect & {
  author: AuthorRow | null;
  parent: { authorId: string; author: { profile: { name: string | null } | null } | null } | null;
  todo: { userId: string } | null;
};
interface AuthorRow {
  userTag: string;
  profile: { name: string | null; profileImage: string | null } | null;
}

const commentRelations = {
  author: {
    columns: { userTag: true },
    with: { profile: { columns: { name: true, profileImage: true } } },
  },
  parent: {
    columns: { authorId: true },
    with: { author: { columns: {}, with: { profile: { columns: { name: true } } } } },
  },
  todo: { columns: { userId: true } },
} as const;

const authorProfile = alias(userProfile, "author_profile");
const authorUser = alias(user, "author_user");
const parentComment = alias(todoComment, "parent_comment");
const parentProfile = alias(userProfile, "parent_profile");
const candidateComment = alias(todoComment, "candidate");
const anchorComment = alias(todoComment, "comment");
const childComment = alias(todoComment, "child");
const previewAuthorProfile = alias(userProfile, "preview_author_profile");
const previewAuthorUser = alias(user, "preview_author_user");
const previewParent = alias(todoComment, "preview_parent");
const previewParentProfile = alias(userProfile, "preview_parent_profile");
const participantProfile = alias(userProfile, "participant_profile");

/** timestamp 컬럼은 드라이버가 UTC 기준 텍스트로 돌려주므로 Date로 좁힌다. */
const timestampText = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?$/)
  .transform((value) => new Date(`${value.replace(" ", "T")}Z`));
const nullableTimestamp = timestampText.nullable();
const nullableText = z.string().nullable();
const nullableInt = z.number().int().nullable();
const pathSchema = z.array(z.string()).nullable();

const commentColumnsSchema = {
  commentId: nullableText,
  todoId: nullableInt,
  parentId: nullableText,
  rootId: nullableText,
  path: pathSchema,
  depth: nullableInt,
  authorId: nullableText,
  authorName: nullableText,
  authorUserTag: nullableText,
  authorProfileImage: nullableText,
  parentAuthorId: nullableText,
  parentAuthorName: nullableText,
  todoOwnerId: nullableText,
  content: nullableText,
  likeCount: nullableInt,
  replyCount: nullableInt,
  rootLikeCount: nullableInt,
  rootReplyCount: nullableInt,
  deletedAt: nullableTimestamp,
  editedAt: nullableTimestamp,
  createdAt: nullableTimestamp,
};

const conversationRowSchema = z.object({
  ...commentColumnsSchema,
  marker: z.enum(["PAGE", "PREVIOUS", "NEXT", "BEFORE", "FOCUS", "AFTER"]),
  continuingAncestorDepths: z.array(z.number().int()).nullable(),
});
type ConversationQueryRow = z.infer<typeof conversationRowSchema>;

const overviewRootRowSchema = z.object({
  ...commentColumnsSchema,
  marker: z.enum(["PAGE", "PREVIOUS", "NEXT"]),
});
type OverviewRootQueryRow = z.infer<typeof overviewRootRowSchema>;

const overviewSummaryRowSchema = z.object({
  rootId: z.string(),
  totalCount: z.coerce.bigint(),
  previewCommentId: nullableText,
  previewTodoId: nullableInt,
  previewParentId: nullableText,
  previewRootId: nullableText,
  previewPath: pathSchema,
  previewDepth: nullableInt,
  previewAuthorId: nullableText,
  previewAuthorName: nullableText,
  previewAuthorUserTag: nullableText,
  previewAuthorProfileImage: nullableText,
  previewParentAuthorId: nullableText,
  previewParentAuthorName: nullableText,
  todoOwnerId: z.string(),
  previewContent: nullableText,
  previewLikeCount: nullableInt,
  previewReplyCount: nullableInt,
  previewDeletedAt: nullableTimestamp,
  previewEditedAt: nullableTimestamp,
  previewCreatedAt: nullableTimestamp,
  participantAuthorId: nullableText,
  participantAuthorName: nullableText,
  participantAuthorProfileImage: nullableText,
  participantIsTodoOwner: z.boolean().nullable(),
});
type OverviewSummaryQueryRow = z.infer<typeof overviewSummaryRowSchema>;

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
  if (value == null) {
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
    path: row.path,
    depth: row.depth,
    parentAuthorId: row.parent?.authorId ?? null,
    parentAuthorName: row.parent?.author?.profile?.name ?? null,
    authorId: requireValue(row.authorId, "authorId"),
    authorName: row.author?.profile?.name ?? null,
    authorUserTag: row.author?.userTag ?? null,
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
  if (row.commentId == null) {
    return null;
  }

  return {
    id: row.commentId,
    todoId: requireValue(row.todoId, "todoId"),
    parentId: row.parentId,
    rootId: row.rootId,
    path: [...requireValue(row.path, "path")],
    depth: requireValue(row.depth, "depth"),
    parentAuthorId: row.parentAuthorId,
    parentAuthorName: row.parentAuthorName,
    authorId: requireValue(row.authorId, "authorId"),
    authorName: row.authorName,
    authorUserTag: row.authorUserTag,
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
  if (row.commentId == null) {
    return null;
  }

  return {
    id: row.commentId,
    todoId: requireValue(row.todoId, "todoId"),
    parentId: row.parentId,
    rootId: row.rootId,
    path: [...requireValue(row.path, "path")],
    depth: requireValue(row.depth, "depth"),
    parentAuthorId: row.parentAuthorId,
    parentAuthorName: row.parentAuthorName,
    authorId: requireValue(row.authorId, "authorId"),
    authorName: row.authorName,
    authorUserTag: row.authorUserTag,
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
  if (row.previewCommentId == null) {
    return null;
  }

  return {
    id: row.previewCommentId,
    todoId: requireValue(row.previewTodoId, "previewTodoId"),
    parentId: row.previewParentId,
    rootId: row.previewRootId,
    path: [...requireValue(row.previewPath, "previewPath")],
    depth: requireValue(row.previewDepth, "previewDepth"),
    parentAuthorId: row.previewParentAuthorId,
    parentAuthorName: row.previewParentAuthorName,
    authorId: requireValue(row.previewAuthorId, "previewAuthorId"),
    authorName: row.previewAuthorName,
    authorUserTag: row.previewAuthorUserTag,
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
  if (row.participantAuthorId == null) {
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
export class DrizzleTodoCommentReader implements TodoCommentReaderPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  private async queryRows<Schema extends z.ZodType>(
    schema: Schema,
    query: SQL,
  ): Promise<z.output<Schema>[]> {
    const result = await this.db.execute<Record<string, unknown>>(query);
    return z.array(schema).parse(result.rows);
  }

  private async isAcceptedFriend(firstUserId: string, secondUserId: string): Promise<boolean> {
    const friendship = await this.db.query.follow.findFirst({
      columns: { id: true },
      where: {
        status: "ACCEPTED",
        OR: [
          { followerId: firstUserId, followingId: secondUserId },
          { followerId: secondUserId, followingId: firstUserId },
        ],
      },
    });

    return friendship != null;
  }

  async findAccessibleTodoOwnerId(todoId: number, viewerId: string): Promise<string | null> {
    const row = await this.db.query.todo.findFirst({
      columns: { userId: true, visibility: true },
      where: { id: todoId },
    });

    if (row == null) {
      return null;
    }

    if (row.userId === viewerId) {
      return row.userId;
    }

    if (row.visibility !== "PUBLIC") {
      return null;
    }

    return (await this.isAcceptedFriend(row.userId, viewerId)) ? row.userId : null;
  }

  async findAccessibleTodoDetails(
    todoId: number,
    viewerId: string,
  ): Promise<TodoDetailsRecord | null> {
    const row = await this.db.query.todo.findFirst({
      where: { id: todoId },
      with: {
        category: true,
        items: { orderBy: { sortOrder: "asc", id: "asc" } },
        user: {
          columns: { id: true },
          with: { profile: { columns: { name: true, profileImage: true } } },
        },
      },
    });
    if (row == null) {
      return null;
    }
    const isOwner = row.userId === viewerId;
    const canAccess =
      isOwner ||
      (row.visibility === "PUBLIC" && (await this.isAcceptedFriend(row.userId, viewerId)));
    if (!canAccess) {
      return null;
    }
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
    const row = await this.db.query.todoComment.findFirst({
      where: { id: commentId, todoId },
      with: commentRelations,
    });

    return row == null ? null : toRecord(row);
  }

  async findCommentRecords(
    todoId: number,
    commentIds: readonly string[],
  ): Promise<TodoCommentRecord[]> {
    if (commentIds.length === 0) {
      return [];
    }

    const rows = await this.db.query.todoComment.findMany({
      where: { todoId, id: { in: [...commentIds] } },
      with: commentRelations,
    });
    const rowsById = new Map(rows.map((row) => [row.id, row]));

    return commentIds.flatMap((commentId) => {
      const row = rowsById.get(commentId);
      return row == null ? [] : [toRecord(row)];
    });
  }

  /** Overview는 root keyset과 선택된 root들의 descendant aggregate를 각각 한 번만 읽는다. */
  async listOverview(
    params: ListTodoCommentOverviewParams,
  ): Promise<TodoCommentOverviewWindow | null> {
    const rootWindow = await this.listOverviewRoots(params);
    if (rootWindow == null) {
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
    const isCursorPage = params.mode === "AFTER" || params.mode === "BEFORE";
    if (isCursorPage && (params.anchorRootId == null || params.anchorPosition == null)) {
      return null;
    }

    const boundaryLikeCount =
      params.anchorPosition == null
        ? sql`anchor."likeCount"`
        : sql`${params.anchorPosition.rootLikeCount}`;
    const boundaryReplyCount =
      params.anchorPosition == null
        ? sql`anchor."replyCount"`
        : sql`${params.anchorPosition.rootReplyCount}`;
    const rootOrder =
      params.sort === TODO_COMMENT_SORT.LATEST
        ? sql`${candidateComment.createdAt} DESC, ${candidateComment.id} DESC`
        : sql`${candidateComment.likeCount} DESC, ${candidateComment.replyCount} DESC, ${candidateComment.createdAt} DESC, ${candidateComment.id} DESC`;
    const reverseRootOrder =
      params.sort === TODO_COMMENT_SORT.LATEST
        ? sql`${candidateComment.createdAt} ASC, ${candidateComment.id} ASC`
        : sql`${candidateComment.likeCount} ASC, ${candidateComment.replyCount} ASC, ${candidateComment.createdAt} ASC, ${candidateComment.id} ASC`;
    const selectedOrder =
      params.sort === TODO_COMMENT_SORT.LATEST
        ? sql`selected."createdAt" DESC, selected."id" DESC`
        : sql`selected."likeCount" DESC, selected."replyCount" DESC, selected."createdAt" DESC, selected."id" DESC`;
    const afterAnchor =
      params.sort === TODO_COMMENT_SORT.LATEST
        ? sql`
					ROW(${candidateComment.createdAt}, ${candidateComment.id})
						< ROW(anchor."createdAt", anchor."id")
				`
        : sql`
					ROW(
						${candidateComment.likeCount},
						${candidateComment.replyCount},
						${candidateComment.createdAt},
						${candidateComment.id}
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
					ROW(${candidateComment.createdAt}, ${candidateComment.id})
						> ROW(anchor."createdAt", anchor."id")
				`
        : sql`
					ROW(
						${candidateComment.likeCount},
						${candidateComment.replyCount},
						${candidateComment.createdAt},
						${candidateComment.id}
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
				FROM ${todoComment} AS ${anchorComment}
				WHERE ${anchorComment.todoId} = ${params.todoId}
					AND ${anchorComment.id} = ${params.anchorRootId ?? null}::TEXT
					AND ${anchorComment.parentId} IS NULL
			)
		`;
    const selectionCte = (() => {
      if (params.mode === "INITIAL") {
        return sql`
					selected AS (
						SELECT candidate.*, 'PAGE'::TEXT AS "marker"
						FROM ${todoComment} AS ${candidateComment}
						WHERE ${candidateComment.todoId} = ${params.todoId}
							AND ${candidateComment.parentId} IS NULL
							AND (${candidateComment.deletedAt} IS NULL OR ${candidateComment.replyCount} > 0)
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
							FROM ${todoComment} AS ${candidateComment}
							CROSS JOIN anchor
							WHERE ${candidateComment.todoId} = ${params.todoId}
								AND ${candidateComment.parentId} IS NULL
								AND (${candidateComment.deletedAt} IS NULL OR ${candidateComment.replyCount} > 0)
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
						FROM ${todoComment} AS ${candidateComment}
						CROSS JOIN anchor
						WHERE ${candidateComment.todoId} = ${params.todoId}
							AND ${candidateComment.parentId} IS NULL
							AND (${candidateComment.deletedAt} IS NULL OR ${candidateComment.replyCount} > 0)
							AND (${beforeAnchor})
						ORDER BY ${reverseRootOrder}
						LIMIT ${params.size + 1}
					)
					UNION ALL
					SELECT anchor.*, 'NEXT'::TEXT AS "marker" FROM anchor
				)
			`;
    })();

    const rows = await this.queryRows(
      overviewRootRowSchema,
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
				${authorProfile.name} AS "authorName",
				${authorUser.userTag} AS "authorUserTag",
				${authorProfile.profileImage} AS "authorProfileImage",
				NULL::TEXT AS "parentAuthorId",
				NULL::TEXT AS "parentAuthorName",
				${todo.userId} AS "todoOwnerId",
				selected."content",
				selected."likeCount",
				selected."replyCount",
				selected."likeCount" AS "rootLikeCount",
				selected."replyCount" AS "rootReplyCount",
				selected."deletedAt",
				selected."editedAt",
				selected."createdAt"
			FROM selected
			INNER JOIN ${todo} ON ${todo.id} = selected."todoId"
			LEFT JOIN ${userProfile} AS ${authorProfile} ON ${authorProfile.userId} = selected."authorId"
			LEFT JOIN ${user} AS ${authorUser} ON ${authorUser.id} = selected."authorId"
			ORDER BY ${selectedOrder}
		`,
    );

    if (isCursorPage && rows.length === 0) {
      return null;
    }

    const markedRecords = rows.flatMap((row) => {
      const record = toOverviewRootRecord(row);
      return record == null ? [] : [{ marker: row.marker, record }];
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
    if (rootIds.length === 0) {
      return new Map();
    }

    const rootIdList = sql.join(
      rootIds.map((id) => sql`${id}`),
      sql`, `,
    );
    const rows = await this.queryRows(
      overviewSummaryRowSchema,
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
						lpad(((extract(epoch FROM ${childComment.createdAt}) * 1000000)::BIGINT)::TEXT, 20, '0') || ':' || ${childComment.id}
					]::TEXT[] AS "dfsPath"
				FROM requested_roots AS requested
				INNER JOIN ${todoComment} AS ${childComment} ON ${childComment.parentId} = requested."rootId"
				WHERE ${childComment.todoId} = ${todoId}

				UNION ALL

				SELECT
					child.*,
					parent."threadId",
					parent."dfsPath" || ARRAY[
						lpad(((extract(epoch FROM ${childComment.createdAt}) * 1000000)::BIGINT)::TEXT, 20, '0') || ':' || ${childComment.id}
					]::TEXT[]
				FROM ${todoComment} AS ${childComment}
				INNER JOIN descendant_tree AS parent ON parent."id" = ${childComment.parentId}
				WHERE ${childComment.todoId} = ${todoId}
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
							(descendant."authorId" = ${todo.userId}) DESC,
							descendant."createdAt" ASC,
							descendant."id" ASC
					) AS "previewRank"
				FROM descendant_tree AS descendant
				INNER JOIN ${todo} ON ${todo.id} = descendant."todoId"
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
							(author_first."authorId" = ${todo.userId}) DESC,
							author_first."dfsPath" ASC,
							author_first."authorId" ASC
					) AS "participantRank"
				FROM author_first
				INNER JOIN ${todo} ON ${todo.id} = author_first."todoId"
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
				${previewAuthorProfile.name} AS "previewAuthorName",
				${previewAuthorUser.userTag} AS "previewAuthorUserTag",
				${previewAuthorProfile.profileImage} AS "previewAuthorProfileImage",
				${previewParent.authorId} AS "previewParentAuthorId",
				${previewParentProfile.name} AS "previewParentAuthorName",
				${todo.userId} AS "todoOwnerId",
				preview."content" AS "previewContent",
				preview."likeCount" AS "previewLikeCount",
				preview."replyCount" AS "previewReplyCount",
				preview."deletedAt" AS "previewDeletedAt",
				preview."editedAt" AS "previewEditedAt",
				preview."createdAt" AS "previewCreatedAt",
				participant."authorId" AS "participantAuthorId",
				${participantProfile.name} AS "participantAuthorName",
				${participantProfile.profileImage} AS "participantAuthorProfileImage",
				(participant."authorId" = ${todo.userId}) AS "participantIsTodoOwner"
			FROM requested_roots AS requested
			INNER JOIN ${todo} ON ${todo.id} = ${todoId}
			LEFT JOIN visible_summary AS summary ON summary."threadId" = requested."rootId"
			LEFT JOIN preview ON preview."threadId" = requested."rootId"
			LEFT JOIN ${userProfile} AS ${previewAuthorProfile}
				ON ${previewAuthorProfile.userId} = preview."authorId"
			LEFT JOIN ${user} AS ${previewAuthorUser} ON ${previewAuthorUser.id} = preview."authorId"
			LEFT JOIN ${todoComment} AS ${previewParent} ON ${previewParent.id} = preview."parentId"
			LEFT JOIN ${userProfile} AS ${previewParentProfile}
				ON ${previewParentProfile.userId} = ${previewParent.authorId}
			LEFT JOIN participants AS participant ON participant."threadId" = requested."rootId"
			LEFT JOIN ${userProfile} AS ${participantProfile}
				ON ${participantProfile.userId} = participant."authorId"
			ORDER BY requested."ordinal" ASC, participant."participantRank" ASC NULLS LAST
		`,
    );

    const summaries = new Map<string, OverviewSummaryRecord>();
    for (const row of rows) {
      const existing = summaries.get(row.rootId);
      const participant = toParticipantAuthor(row);

      if (existing == null) {
        summaries.set(row.rootId, {
          previewReply: toOverviewPreviewRecord(row),
          totalCount: toSafeCount(row.totalCount, "totalCount"),
          participantAuthors: participant == null ? [] : [participant],
        });
        continue;
      }

      if (participant != null) {
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
    const isCursorPage = params.mode === "AFTER" || params.mode === "BEFORE";
    if (
      isCursorPage &&
      (params.anchorCommentId == null ||
        params.anchorThreadId == null ||
        params.anchorPosition == null)
    ) {
      return null;
    }

    const snapshotBoundary =
      params.anchorPosition == null
        ? null
        : {
            position: params.anchorPosition,
            threadId: requireValue(params.anchorThreadId ?? null, "anchorThreadId"),
          };
    const boundaryThreadId = sql`anchor."threadId"`;
    const boundaryRootLikeCount =
      snapshotBoundary == null
        ? sql`anchor."rootLikeCount"`
        : sql`${snapshotBoundary.position.rootLikeCount}`;
    const boundaryRootReplyCount =
      snapshotBoundary == null
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
      snapshotBoundary == null
        ? sql`candidate."rootLikeCount"`
        : sql`
				CASE
					WHEN candidate."threadId" = ${snapshotBoundary.threadId}::TEXT
						THEN ${snapshotBoundary.position.rootLikeCount}
					ELSE candidate."rootLikeCount"
				END
			`;
    const candidateRootReplyCountAtBoundary =
      snapshotBoundary == null
        ? sql`candidate."rootReplyCount"`
        : sql`
				CASE
					WHEN candidate."threadId" = ${snapshotBoundary.threadId}::TEXT
						THEN ${snapshotBoundary.position.rootReplyCount}
					ELSE candidate."rootReplyCount"
				END
			`;
    const selectedRootLikeCountAtBoundary =
      snapshotBoundary == null
        ? sql`selected."rootLikeCount"`
        : sql`
				CASE
					WHEN selected."threadId" = ${snapshotBoundary.threadId}::TEXT
						THEN ${snapshotBoundary.position.rootLikeCount}
					ELSE selected."rootLikeCount"
				END
			`;
    const selectedRootReplyCountAtBoundary =
      snapshotBoundary == null
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
    const rows = await this.queryRows(
      conversationRowSchema,
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
				${authorProfile.name} AS "authorName",
				${authorUser.userTag} AS "authorUserTag",
				${authorProfile.profileImage} AS "authorProfileImage",
				${parentComment.authorId} AS "parentAuthorId",
				${parentProfile.name} AS "parentAuthorName",
				${todo.userId} AS "todoOwnerId",
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
			LEFT JOIN ${todo} ON ${todo.id} = selected."todoId"
			LEFT JOIN ${userProfile} AS ${authorProfile} ON ${authorProfile.userId} = selected."authorId"
			LEFT JOIN ${user} AS ${authorUser} ON ${authorUser.id} = selected."authorId"
			LEFT JOIN ${todoComment} AS ${parentComment} ON ${parentComment.id} = selected."parentId"
			LEFT JOIN ${userProfile} AS ${parentProfile} ON ${parentProfile.userId} = ${parentComment.authorId}
			ORDER BY ${selectedOrder}
		`,
    );

    if (params.mode !== "INITIAL" && rows.length === 0) {
      return null;
    }

    const markedRecords = rows.flatMap((row) => {
      const record = toConversationRecord(row);
      return record == null ? [] : [{ marker: row.marker, record }];
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
    if (focus == null) {
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
    const selectedBefore = beforeCount === 0 ? [] : before.slice(-beforeCount);
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

    const likes = await this.db.query.todoCommentLike.findMany({
      columns: { commentId: true },
      where: { commentId: { in: [...commentIds] }, userId: viewerId, isActive: true },
    });

    return new Set(likes.map((like) => like.commentId));
  }

  async findUserDisplayName(userId: string): Promise<string | null> {
    const profile = await this.db.query.userProfile.findFirst({
      columns: { name: true },
      where: { userId },
    });

    return profile?.name ?? null;
  }
}
