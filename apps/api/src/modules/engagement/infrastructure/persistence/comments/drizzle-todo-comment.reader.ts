import { TODO_COMMENT_LIMITS, TODO_COMMENT_SORT } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { nullableRawTimestampSchema } from "#api/platform/database/raw-timestamp.schema";
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
import { toTodoResponse } from "./todo-details.mapper.js";

type CommentWithRelationsRow = typeof todoComment.$inferSelect & {
  author: AuthorRow | null;
  replyTo: { authorId: string; author: { profile: { name: string | null } | null } | null } | null;
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
  replyTo: {
    columns: { authorId: true },
    with: { author: { columns: {}, with: { profile: { columns: { name: true } } } } },
  },
  todo: { columns: { userId: true } },
} as const;

const authorProfile = alias(userProfile, "author_profile");
const authorUser = alias(user, "author_user");
const replyTargetComment = alias(todoComment, "reply_target");
const replyTargetProfile = alias(userProfile, "reply_target_profile");
const candidateComment = alias(todoComment, "candidate");
const anchorComment = alias(todoComment, "comment");
const headComment = alias(todoComment, "head");
const replyComment = alias(todoComment, "reply");
const focusComment = alias(todoComment, "focus");
const previewComment = alias(todoComment, "preview");
const participantComment = alias(todoComment, "participant");
const previewAuthorProfile = alias(userProfile, "preview_author_profile");
const previewAuthorUser = alias(user, "preview_author_user");
const previewTarget = alias(todoComment, "preview_target");
const previewTargetProfile = alias(userProfile, "preview_target_profile");
const participantProfile = alias(userProfile, "participant_profile");

const nullableText = z.string().nullable();
const nullableInt = z.number().int().nullable();

const commentColumnsSchema = {
  commentId: nullableText,
  todoId: nullableInt,
  threadCommentId: nullableText,
  replyToCommentId: nullableText,
  authorId: nullableText,
  authorName: nullableText,
  authorUserTag: nullableText,
  authorProfileImage: nullableText,
  replyToAuthorId: nullableText,
  replyToAuthorName: nullableText,
  todoOwnerId: nullableText,
  content: nullableText,
  likeCount: nullableInt,
  replyCount: nullableInt,
  rootLikeCount: nullableInt,
  rootReplyCount: nullableInt,
  deletedAt: nullableRawTimestampSchema,
  editedAt: nullableRawTimestampSchema,
  createdAt: nullableRawTimestampSchema,
};

const conversationRowSchema = z.object({
  ...commentColumnsSchema,
  marker: z.enum(["PAGE", "PREVIOUS", "NEXT", "BEFORE", "FOCUS", "AFTER"]),
});
type ConversationQueryRow = z.infer<typeof conversationRowSchema>;

const overviewRootRowSchema = z.object({
  ...commentColumnsSchema,
  marker: z.enum(["PAGE", "PREVIOUS", "NEXT"]),
});
type OverviewRootQueryRow = z.infer<typeof overviewRootRowSchema>;

const overviewSummaryRowSchema = z.object({
  rootId: z.string(),
  previewCommentId: nullableText,
  previewTodoId: nullableInt,
  previewThreadCommentId: nullableText,
  previewReplyToCommentId: nullableText,
  previewAuthorId: nullableText,
  previewAuthorName: nullableText,
  previewAuthorUserTag: nullableText,
  previewAuthorProfileImage: nullableText,
  previewReplyToAuthorId: nullableText,
  previewReplyToAuthorName: nullableText,
  todoOwnerId: z.string(),
  previewContent: nullableText,
  previewLikeCount: nullableInt,
  previewReplyCount: nullableInt,
  previewDeletedAt: nullableRawTimestampSchema,
  previewEditedAt: nullableRawTimestampSchema,
  previewCreatedAt: nullableRawTimestampSchema,
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
  participantAuthors: TodoCommentParticipantAuthorRecord[];
}

function requireValue<T>(value: T | null, field: string): T {
  if (value == null) {
    throw new Error(`댓글 대화 조회 결과에 ${field} 값이 없습니다.`);
  }

  return value;
}

function toRecord(row: CommentWithRelationsRow): TodoCommentRecord {
  return {
    id: row.id,
    todoId: row.todoId,
    threadCommentId: row.parentId,
    replyToCommentId: row.replyToCommentId,
    replyToAuthorId: row.replyTo?.authorId ?? null,
    replyToAuthorName: row.replyTo?.author?.profile?.name ?? null,
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
    threadCommentId: row.threadCommentId,
    replyToCommentId: row.replyToCommentId,
    replyToAuthorId: row.replyToAuthorId,
    replyToAuthorName: row.replyToAuthorName,
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
    threadCommentId: row.threadCommentId,
    replyToCommentId: row.replyToCommentId,
    replyToAuthorId: row.replyToAuthorId,
    replyToAuthorName: row.replyToAuthorName,
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
    threadCommentId: row.previewThreadCommentId,
    replyToCommentId: row.previewReplyToCommentId,
    replyToAuthorId: row.previewReplyToAuthorId,
    replyToAuthorName: row.previewReplyToAuthorName,
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

  /** Overview는 댓글 keyset을 읽고, 선택된 댓글마다 대표 답글과 참여자를 LATERAL로 한 번에 붙인다. */
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
          totalCount: comment.replyCount,
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
				selected."parentId" AS "threadCommentId",
				selected."replyToCommentId",
				selected."authorId",
				${authorProfile.name} AS "authorName",
				${authorUser.userTag} AS "authorUserTag",
				${authorProfile.profileImage} AS "authorProfileImage",
				NULL::TEXT AS "replyToAuthorId",
				NULL::TEXT AS "replyToAuthorName",
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
			SELECT
				requested."rootId",
				${previewComment.id} AS "previewCommentId",
				${previewComment.todoId} AS "previewTodoId",
				${previewComment.parentId} AS "previewThreadCommentId",
				${previewComment.replyToCommentId} AS "previewReplyToCommentId",
				${previewComment.authorId} AS "previewAuthorId",
				${previewAuthorProfile.name} AS "previewAuthorName",
				${previewAuthorUser.userTag} AS "previewAuthorUserTag",
				${previewAuthorProfile.profileImage} AS "previewAuthorProfileImage",
				${previewTarget.authorId} AS "previewReplyToAuthorId",
				${previewTargetProfile.name} AS "previewReplyToAuthorName",
				${todo.userId} AS "todoOwnerId",
				${previewComment.content} AS "previewContent",
				${previewComment.likeCount} AS "previewLikeCount",
				${previewComment.replyCount} AS "previewReplyCount",
				${previewComment.deletedAt} AS "previewDeletedAt",
				${previewComment.editedAt} AS "previewEditedAt",
				${previewComment.createdAt} AS "previewCreatedAt",
				participant."authorId" AS "participantAuthorId",
				${participantProfile.name} AS "participantAuthorName",
				${participantProfile.profileImage} AS "participantAuthorProfileImage",
				(participant."authorId" = ${todo.userId}) AS "participantIsTodoOwner"
			FROM unnest(ARRAY[${rootIdList}]::TEXT[]) WITH ORDINALITY AS requested("rootId", "ordinal")
			INNER JOIN ${todo} ON ${todo.id} = ${todoId}
			LEFT JOIN LATERAL (
				SELECT preview.*
				FROM ${todoComment} AS ${previewComment}
				WHERE ${previewComment.parentId} = requested."rootId"
					AND ${previewComment.deletedAt} IS NULL
				ORDER BY
					(${previewComment.authorId} = ${todo.userId}) DESC,
					${previewComment.createdAt} ASC,
					${previewComment.id} ASC
				LIMIT 1
			) AS ${previewComment} ON TRUE
			LEFT JOIN ${userProfile} AS ${previewAuthorProfile}
				ON ${previewAuthorProfile.userId} = ${previewComment.authorId}
			LEFT JOIN ${user} AS ${previewAuthorUser} ON ${previewAuthorUser.id} = ${previewComment.authorId}
			LEFT JOIN ${todoComment} AS ${previewTarget}
				ON ${previewTarget.id} = ${previewComment.replyToCommentId}
			LEFT JOIN ${userProfile} AS ${previewTargetProfile}
				ON ${previewTargetProfile.userId} = ${previewTarget.authorId}
			LEFT JOIN LATERAL (
				SELECT
					${participantComment.authorId} AS "authorId",
					MIN(${participantComment.createdAt}) AS "firstRepliedAt"
				FROM ${todoComment} AS ${participantComment}
				WHERE ${participantComment.parentId} = requested."rootId"
					AND ${participantComment.deletedAt} IS NULL
				GROUP BY ${participantComment.authorId}
				ORDER BY
					(${participantComment.authorId} = ${todo.userId}) DESC,
					MIN(${participantComment.createdAt}) ASC,
					${participantComment.authorId} ASC
				LIMIT ${TODO_COMMENT_LIMITS.OVERVIEW_PARTICIPANT_MAX_SIZE}
			) AS participant ON TRUE
			LEFT JOIN ${userProfile} AS ${participantProfile}
				ON ${participantProfile.userId} = participant."authorId"
			ORDER BY
				requested."ordinal" ASC,
				(participant."authorId" = ${todo.userId}) DESC,
				participant."firstRepliedAt" ASC NULLS LAST,
				participant."authorId" ASC
		`,
    );

    const summaries = new Map<string, OverviewSummaryRecord>();
    for (const row of rows) {
      const existing = summaries.get(row.rootId);
      const participant = toParticipantAuthor(row);

      if (existing == null) {
        summaries.set(row.rootId, {
          previewReply: toOverviewPreviewRecord(row),
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
   * 묶음은 최신/인기순으로, 묶음 안은 머리 댓글 다음 답글을 작성 순으로 세운다.
   * 묶음 위치와 (머리 여부, createdAt, id)를 keyset 비교하고, 경계 뒤 한 행을 더 읽어 연결선 연속성을 확정한다.
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
    const candidateThreadOrder = sql`ROW(candidate."replyRank", candidate."createdAt", candidate."id")`;
    const boundaryThreadOrder = sql`ROW(anchor."replyRank", anchor."createdAt", anchor."id")`;
    const cursorScopeCondition =
      params.scope === "THREAD" ? sql`candidate."threadId" = anchor."threadId"` : sql`TRUE`;
    const threadCondition = (() => {
      if (params.mode === "FOCUS") {
        return sql`${headComment.id} = (
					SELECT COALESCE(${focusComment.parentId}, ${focusComment.id})
					FROM ${todoComment} AS ${focusComment}
					WHERE ${focusComment.todoId} = ${params.todoId}
						AND ${focusComment.id} = ${params.anchorCommentId ?? null}::TEXT
				)`;
      }

      return params.scope === "THREAD"
        ? sql`${headComment.id} = ${params.anchorThreadId ?? null}::TEXT`
        : sql`TRUE`;
    })();
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
        ? sql`candidate."rootCreatedAt" DESC, candidate."threadId" DESC, candidate."replyRank" ASC, candidate."createdAt" ASC, candidate."id" ASC`
        : sql`${candidateRootLikeCountAtBoundary} DESC, ${candidateRootReplyCountAtBoundary} DESC, candidate."rootCreatedAt" DESC, candidate."threadId" DESC, candidate."replyRank" ASC, candidate."createdAt" ASC, candidate."id" ASC`;
    const reverseCandidateOrder =
      params.sort === TODO_COMMENT_SORT.LATEST
        ? sql`candidate."rootCreatedAt" ASC, candidate."threadId" ASC, candidate."replyRank" DESC, candidate."createdAt" DESC, candidate."id" DESC`
        : sql`${candidateRootLikeCountAtBoundary} ASC, ${candidateRootReplyCountAtBoundary} ASC, candidate."rootCreatedAt" ASC, candidate."threadId" ASC, candidate."replyRank" DESC, candidate."createdAt" DESC, candidate."id" DESC`;
    const selectedOrder =
      params.sort === TODO_COMMENT_SORT.LATEST
        ? sql`selected."rootCreatedAt" DESC, selected."threadId" DESC, selected."replyRank" ASC, selected."createdAt" ASC, selected."id" ASC`
        : sql`${selectedRootLikeCountAtBoundary} DESC, ${selectedRootReplyCountAtBoundary} DESC, selected."rootCreatedAt" DESC, selected."threadId" DESC, selected."replyRank" ASC, selected."createdAt" ASC, selected."id" ASC`;
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
						AND ${candidateThreadOrder} > ${boundaryThreadOrder}
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
						AND ${candidateThreadOrder} > ${boundaryThreadOrder}
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
						AND ${candidateThreadOrder} < ${boundaryThreadOrder}
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
						AND ${candidateThreadOrder} < ${boundaryThreadOrder}
					)
				`;
    const anchorCte = sql`
			anchor AS (
				SELECT tree.*
				FROM tree
				WHERE tree."id" = ${params.anchorCommentId ?? null}::TEXT
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
			WITH threads AS (
				SELECT head.*
				FROM ${todoComment} AS ${headComment}
				WHERE ${headComment.todoId} = ${params.todoId}
					AND ${headComment.parentId} IS NULL
					AND (${threadCondition})
			),
			tree AS (
				SELECT
					head.*,
					head."id" AS "threadId",
					head."likeCount" AS "rootLikeCount",
					head."replyCount" AS "rootReplyCount",
					head."createdAt" AS "rootCreatedAt",
					0 AS "replyRank"
				FROM threads AS head

				UNION ALL

				SELECT
					reply.*,
					head."id",
					head."likeCount",
					head."replyCount",
					head."createdAt",
					1
				FROM threads AS head
				INNER JOIN ${todoComment} AS ${replyComment} ON ${replyComment.parentId} = head."id"
			),
			${selectionCte}
			SELECT
				selected."marker",
				selected."id" AS "commentId",
				selected."todoId",
				selected."parentId" AS "threadCommentId",
				selected."replyToCommentId",
				selected."authorId",
				${authorProfile.name} AS "authorName",
				${authorUser.userTag} AS "authorUserTag",
				${authorProfile.profileImage} AS "authorProfileImage",
				${replyTargetComment.authorId} AS "replyToAuthorId",
				${replyTargetProfile.name} AS "replyToAuthorName",
				${todo.userId} AS "todoOwnerId",
				selected."content",
				selected."likeCount",
				selected."replyCount",
				${selectedRootLikeCountAtBoundary} AS "rootLikeCount",
				${selectedRootReplyCountAtBoundary} AS "rootReplyCount",
				selected."deletedAt",
				selected."editedAt",
				selected."createdAt"
			FROM selected
			LEFT JOIN ${todo} ON ${todo.id} = selected."todoId"
			LEFT JOIN ${userProfile} AS ${authorProfile} ON ${authorProfile.userId} = selected."authorId"
			LEFT JOIN ${user} AS ${authorUser} ON ${authorUser.id} = selected."authorId"
			LEFT JOIN ${todoComment} AS ${replyTargetComment}
				ON ${replyTargetComment.id} = selected."replyToCommentId"
			LEFT JOIN ${userProfile} AS ${replyTargetProfile}
				ON ${replyTargetProfile.userId} = ${replyTargetComment.authorId}
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
