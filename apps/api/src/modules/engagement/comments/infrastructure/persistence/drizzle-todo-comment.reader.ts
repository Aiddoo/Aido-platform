import { TODO_COMMENT_LIMITS, TODO_COMMENT_SORT } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todo, todoComment, user, userProfile } from "#api/platform/database/schema/index";

import type { TodoCommentReaderPort } from "../../application/ports/todo-comment.reader.port.js";
import type {
  ListTodoCommentRepliesParams,
  ListTodoCommentThreadsParams,
  ListTodoConversationParams,
  TodoCommentParticipantAuthorReadModel,
  TodoCommentReadModel,
  TodoCommentThreadItemReadModel,
  TodoCommentThreadReadModel,
  TodoCommentWindow,
  TodoConversationReadModel,
  TodoConversationWindow,
  TodoDetailsReadModel,
} from "../../application/read-models/todo-comment.read-model.js";
import {
  commentColumns,
  commentJoins,
  commentRowSchema,
  rootPositionRowSchema,
  toCommentRecord,
  toRootPosition,
} from "./todo-comment-read-model.mapper.js";
import {
  toTodoCommentKeysetWindow,
  type MarkedTodoCommentRow,
  type TodoCommentRowMarker,
} from "./todo-comment-window.mapper.js";
import { toTodoResponse } from "./todo-details-row.mapper.js";

const candidateComment = alias(todoComment, "candidate");
const anchorComment = alias(todoComment, "comment");
const headComment = alias(todoComment, "head");
const replyComment = alias(todoComment, "reply");
const focusComment = alias(todoComment, "focus");
const previewComment = alias(todoComment, "preview");
const participantComment = alias(todoComment, "participant");
const participantProfile = alias(userProfile, "participant_profile");
const participantUser = alias(user, "participant_user");

const markerSchema = z.enum(["PAGE", "PREVIOUS", "NEXT", "BEFORE", "FOCUS", "AFTER"]);
const markedCommentRowSchema = commentRowSchema.extend({ marker: markerSchema });
const markedRootRowSchema = markedCommentRowSchema.extend(rootPositionRowSchema.shape);
type MarkedRootRow = z.infer<typeof markedRootRowSchema>;

const threadSummaryRowSchema = commentRowSchema.extend({
  rootId: z.string(),
  participantAuthorId: z.string().nullable(),
  participantAuthorName: z.string().nullable(),
  participantAuthorUserTag: z.string().nullable(),
  participantAuthorProfileImage: z.string().nullable(),
  participantIsTodoOwner: z.boolean().nullable(),
});
type ThreadSummaryRow = z.infer<typeof threadSummaryRowSchema>;

interface ThreadSummary {
  previewReply: TodoCommentReadModel | null;
  participantAuthors: TodoCommentParticipantAuthorReadModel[];
}

function toMarkedRecords<Row extends { marker: TodoCommentRowMarker }, T>(
  rows: readonly Row[],
  toRecord: (row: Row) => T | null,
): MarkedTodoCommentRow<T>[] {
  return rows.flatMap((row) => {
    const record = toRecord(row);
    return record == null ? [] : [{ marker: row.marker, record }];
  });
}

function toThreadRecord(row: MarkedRootRow): TodoCommentThreadReadModel | null {
  const record = toCommentRecord(row);
  return record == null ? null : { ...record, threadPosition: toRootPosition(row) };
}

function toConversationRecord(row: MarkedRootRow): TodoConversationReadModel | null {
  const record = toCommentRecord(row);
  return record == null ? null : { ...record, conversationPosition: toRootPosition(row) };
}

function toParticipantAuthor(row: ThreadSummaryRow): TodoCommentParticipantAuthorReadModel | null {
  if (row.participantAuthorId == null) {
    return null;
  }

  return {
    id: row.participantAuthorId,
    name: row.participantAuthorName,
    userTag: row.participantAuthorUserTag,
    profileImage: row.participantAuthorProfileImage,
    isTodoOwner: row.participantIsTodoOwner ?? false,
  };
}

function toPageMode(
  mode: ListTodoCommentThreadsParams["mode"] | ListTodoCommentRepliesParams["mode"],
): "INITIAL" | "BEFORE" | "AFTER" | "FOCUS" {
  return mode === "ANCHOR" || mode === "AROUND" ? "FOCUS" : mode;
}

@Injectable()
export class DrizzleTodoCommentReader implements TodoCommentReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async #queryRows<Schema extends z.ZodType>(
    schema: Schema,
    query: SQL,
  ): Promise<z.output<Schema>[]> {
    const result = await this.#db.execute<Record<string, unknown>>(query);
    return z.array(schema).parse(result.rows);
  }

  async #isAcceptedFriend(firstUserId: string, secondUserId: string): Promise<boolean> {
    const friendship = await this.#db.query.follow.findFirst({
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
    const row = await this.#db.query.todo.findFirst({
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

    return (await this.#isAcceptedFriend(row.userId, viewerId)) ? row.userId : null;
  }

  async findAccessibleTodoDetails(
    todoId: number,
    viewerId: string,
  ): Promise<TodoDetailsReadModel | null> {
    const row = await this.#db.query.todo.findFirst({
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
      (row.visibility === "PUBLIC" && (await this.#isAcceptedFriend(row.userId, viewerId)));
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

  async findCommentRecord(todoId: number, commentId: string): Promise<TodoCommentReadModel | null> {
    const [record] = await this.findCommentRecords(todoId, [commentId]);
    return record ?? null;
  }

  async findCommentRecords(
    todoId: number,
    commentIds: readonly string[],
  ): Promise<TodoCommentReadModel[]> {
    if (commentIds.length === 0) {
      return [];
    }

    const rows = await this.#queryRows(
      commentRowSchema,
      sql`
			SELECT ${commentColumns(sql`comment`)}
			FROM ${todoComment} AS ${anchorComment}
			${commentJoins(sql`comment`)}
			WHERE ${anchorComment.todoId} = ${todoId}
				AND ${anchorComment.id} IN (${sql.join(
          commentIds.map((id) => sql`${id}`),
          sql`, `,
        )})
		`,
    );
    const recordsById = new Map(
      rows.flatMap((row) => {
        const record = toCommentRecord(row);
        return record == null ? [] : [[record.id, record] as const];
      }),
    );

    return commentIds.flatMap((commentId) => {
      const record = recordsById.get(commentId);
      return record == null ? [] : [record];
    });
  }

  /** 묶음 머리 keyset을 읽고, 고른 묶음마다 대표 답글과 참여자를 LATERAL로 한 번에 붙인다. */
  async listThreads(
    params: ListTodoCommentThreadsParams,
  ): Promise<TodoCommentWindow<TodoCommentThreadItemReadModel> | null> {
    const window = await this.#listThreadComments(params);
    if (window == null) {
      return null;
    }

    const summaries = await this.#findThreadSummaries(
      params.todoId,
      window.items.map((record) => record.id),
    );

    return {
      items: window.items.map((comment) => {
        const summary = summaries.get(comment.id);
        return {
          comment,
          previewReply: summary?.previewReply ?? null,
          totalCount: comment.replyCount,
          participantAuthors: summary?.participantAuthors ?? [],
        };
      }),
      hasPrevious: window.hasPrevious,
      hasNext: window.hasNext,
    };
  }

  async #listThreadComments(
    params: ListTodoCommentThreadsParams,
  ): Promise<TodoCommentWindow<TodoCommentThreadReadModel> | null> {
    if (params.mode !== "INITIAL" && params.anchorCommentId == null) {
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
    const isLatest = params.sort === TODO_COMMENT_SORT.LATEST;
    const rootOrder = isLatest
      ? sql`${candidateComment.createdAt} DESC, ${candidateComment.id} DESC`
      : sql`${candidateComment.likeCount} DESC, ${candidateComment.replyCount} DESC, ${candidateComment.createdAt} DESC, ${candidateComment.id} DESC`;
    const reverseRootOrder = isLatest
      ? sql`${candidateComment.createdAt} ASC, ${candidateComment.id} ASC`
      : sql`${candidateComment.likeCount} ASC, ${candidateComment.replyCount} ASC, ${candidateComment.createdAt} ASC, ${candidateComment.id} ASC`;
    const selectedOrder = isLatest
      ? sql`selected."createdAt" DESC, selected."id" DESC`
      : sql`selected."likeCount" DESC, selected."replyCount" DESC, selected."createdAt" DESC, selected."id" DESC`;
    const candidatePosition = isLatest
      ? sql`ROW(${candidateComment.createdAt}, ${candidateComment.id})`
      : sql`ROW(${candidateComment.likeCount}, ${candidateComment.replyCount}, ${candidateComment.createdAt}, ${candidateComment.id})`;
    const anchorPosition = isLatest
      ? sql`ROW(anchor."createdAt", anchor."id")`
      : sql`ROW(${boundaryLikeCount}, ${boundaryReplyCount}, anchor."createdAt", anchor."id")`;
    const visibleThread = sql`
			${candidateComment.todoId} = ${params.todoId}
				AND ${candidateComment.parentId} IS NULL
				AND (${candidateComment.deletedAt} IS NULL OR ${candidateComment.replyCount} > 0)
		`;
    const anchorVisibility =
      params.mode === "ANCHOR"
        ? sql`AND (${anchorComment.deletedAt} IS NULL OR ${anchorComment.replyCount} > 0)`
        : sql``;
    const anchorCte = sql`
			anchor AS (
				SELECT comment.*
				FROM ${todoComment} AS ${anchorComment}
				WHERE ${anchorComment.todoId} = ${params.todoId}
					AND ${anchorComment.id} = ${params.anchorCommentId ?? null}::TEXT
					AND ${anchorComment.parentId} IS NULL
					${anchorVisibility}
			)
		`;
    const after = (marker: TodoCommentRowMarker) => sql`
			(
				SELECT candidate.*, ${marker}::TEXT AS "marker"
				FROM ${todoComment} AS ${candidateComment}
				CROSS JOIN anchor
				WHERE ${visibleThread} AND ${candidatePosition} < ${anchorPosition}
				ORDER BY ${rootOrder}
				LIMIT ${params.size + 1}
			)
		`;
    const before = (marker: TodoCommentRowMarker) => sql`
			(
				SELECT candidate.*, ${marker}::TEXT AS "marker"
				FROM ${todoComment} AS ${candidateComment}
				CROSS JOIN anchor
				WHERE ${visibleThread} AND ${candidatePosition} > ${anchorPosition}
				ORDER BY ${reverseRootOrder}
				LIMIT ${params.size + 1}
			)
		`;
    const selectionCte = (() => {
      switch (params.mode) {
        case "INITIAL":
          return sql`
						selected AS (
							SELECT candidate.*, 'PAGE'::TEXT AS "marker"
							FROM ${todoComment} AS ${candidateComment}
							WHERE ${visibleThread}
							ORDER BY ${rootOrder}
							LIMIT ${params.size + 1}
						)
					`;
        case "AFTER":
          return sql`${anchorCte}, selected AS (
						${after("PAGE")}
						UNION ALL
						SELECT anchor.*, 'PREVIOUS'::TEXT AS "marker" FROM anchor
					)`;
        case "BEFORE":
          return sql`${anchorCte}, selected AS (
						${before("PAGE")}
						UNION ALL
						SELECT anchor.*, 'NEXT'::TEXT AS "marker" FROM anchor
					)`;
        case "ANCHOR":
          return sql`${anchorCte}, selected AS (
						${before("BEFORE")}
						UNION ALL
						SELECT anchor.*, 'FOCUS'::TEXT AS "marker" FROM anchor
						UNION ALL
						${after("AFTER")}
					)`;
      }
    })();

    const rows = await this.#queryRows(
      markedRootRowSchema,
      sql`
			WITH ${selectionCte}
			SELECT
				selected."marker",
				${commentColumns(sql`selected`)},
				selected."likeCount" AS "rootLikeCount",
				selected."replyCount" AS "rootReplyCount"
			FROM selected
			${commentJoins(sql`selected`)}
			ORDER BY ${selectedOrder}
		`,
    );

    if (params.mode !== "INITIAL" && rows.length === 0) {
      return null;
    }

    const window = toTodoCommentKeysetWindow(
      toMarkedRecords(rows, toThreadRecord),
      toPageMode(params.mode),
      params.size,
    );
    return { items: window.items, hasPrevious: window.hasPrevious, hasNext: window.hasNext };
  }

  async #findThreadSummaries(
    todoId: number,
    threadCommentIds: readonly string[],
  ): Promise<Map<string, ThreadSummary>> {
    if (threadCommentIds.length === 0) {
      return new Map();
    }

    const rows = await this.#queryRows(
      threadSummaryRowSchema,
      sql`
			SELECT
				requested."rootId",
				${commentColumns(sql`preview`)},
				participant."authorId" AS "participantAuthorId",
				${participantProfile.name} AS "participantAuthorName",
				${participantUser.userTag} AS "participantAuthorUserTag",
				${participantProfile.profileImage} AS "participantAuthorProfileImage",
				(participant."authorId" = owner_todo."userId") AS "participantIsTodoOwner"
			FROM unnest(ARRAY[${sql.join(
        threadCommentIds.map((id) => sql`${id}`),
        sql`, `,
      )}]::TEXT[]) WITH ORDINALITY AS requested("rootId", "ordinal")
			INNER JOIN ${todo} AS owner_todo ON owner_todo."id" = ${todoId}
			LEFT JOIN LATERAL (
				SELECT preview.*
				FROM ${todoComment} AS ${previewComment}
				WHERE ${previewComment.parentId} = requested."rootId"
					AND ${previewComment.deletedAt} IS NULL
				ORDER BY
					(${previewComment.authorId} = owner_todo."userId") DESC,
					${previewComment.createdAt} ASC,
					${previewComment.id} ASC
				LIMIT 1
			) AS preview ON TRUE
			${commentJoins(sql`preview`)}
			LEFT JOIN LATERAL (
				SELECT
					${participantComment.authorId} AS "authorId",
					MIN(${participantComment.createdAt}) AS "firstRepliedAt"
				FROM ${todoComment} AS ${participantComment}
				WHERE ${participantComment.parentId} = requested."rootId"
					AND ${participantComment.deletedAt} IS NULL
				GROUP BY ${participantComment.authorId}
				ORDER BY
					(${participantComment.authorId} = owner_todo."userId") DESC,
					MIN(${participantComment.createdAt}) ASC,
					${participantComment.authorId} ASC
				LIMIT ${TODO_COMMENT_LIMITS.OVERVIEW_PARTICIPANT_MAX_SIZE}
			) AS participant ON TRUE
			LEFT JOIN ${userProfile} AS ${participantProfile}
				ON ${participantProfile.userId} = participant."authorId"
			LEFT JOIN ${user} AS ${participantUser} ON ${participantUser.id} = participant."authorId"
			ORDER BY
				requested."ordinal" ASC,
				(participant."authorId" = owner_todo."userId") DESC,
				participant."firstRepliedAt" ASC NULLS LAST,
				participant."authorId" ASC
		`,
    );

    const summaries = new Map<string, ThreadSummary>();
    for (const row of rows) {
      const participant = toParticipantAuthor(row);
      const existing = summaries.get(row.rootId);
      if (existing == null) {
        summaries.set(row.rootId, {
          previewReply: toCommentRecord(row),
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

  /** 묶음 하나의 답글을 작성 순서로 읽는다. 지운 답글은 목록에서 빠지지만 cursor 위치로는 남는다. */
  async listReplies(
    params: ListTodoCommentRepliesParams,
  ): Promise<TodoCommentWindow<TodoCommentReadModel> | null> {
    if (params.mode !== "INITIAL" && params.anchorReplyId == null) {
      return null;
    }

    const visibleReply = sql`
			${candidateComment.todoId} = ${params.todoId}
				AND ${candidateComment.parentId} = ${params.threadCommentId}
				AND ${candidateComment.deletedAt} IS NULL
		`;
    const candidatePosition = sql`ROW(${candidateComment.createdAt}, ${candidateComment.id})`;
    const anchorPosition = sql`ROW(anchor."createdAt", anchor."id")`;
    const anchorVisibility =
      params.mode === "AROUND" ? sql`AND ${anchorComment.deletedAt} IS NULL` : sql``;
    const anchorCte = sql`
			anchor AS (
				SELECT comment.*
				FROM ${todoComment} AS ${anchorComment}
				WHERE ${anchorComment.todoId} = ${params.todoId}
					AND ${anchorComment.parentId} = ${params.threadCommentId}
					AND ${anchorComment.id} = ${params.anchorReplyId ?? null}::TEXT
					${anchorVisibility}
			)
		`;
    const after = (marker: TodoCommentRowMarker) => sql`
			(
				SELECT candidate.*, ${marker}::TEXT AS "marker"
				FROM ${todoComment} AS ${candidateComment}
				CROSS JOIN anchor
				WHERE ${visibleReply} AND ${candidatePosition} > ${anchorPosition}
				ORDER BY ${candidateComment.createdAt} ASC, ${candidateComment.id} ASC
				LIMIT ${params.size + 1}
			)
		`;
    const before = (marker: TodoCommentRowMarker) => sql`
			(
				SELECT candidate.*, ${marker}::TEXT AS "marker"
				FROM ${todoComment} AS ${candidateComment}
				CROSS JOIN anchor
				WHERE ${visibleReply} AND ${candidatePosition} < ${anchorPosition}
				ORDER BY ${candidateComment.createdAt} DESC, ${candidateComment.id} DESC
				LIMIT ${params.size + 1}
			)
		`;
    const selectionCte = (() => {
      switch (params.mode) {
        case "INITIAL":
          return sql`
						selected AS (
							SELECT candidate.*, 'PAGE'::TEXT AS "marker"
							FROM ${todoComment} AS ${candidateComment}
							WHERE ${visibleReply}
							ORDER BY ${candidateComment.createdAt} ASC, ${candidateComment.id} ASC
							LIMIT ${params.size + 1}
						)
					`;
        case "AFTER":
          return sql`${anchorCte}, selected AS (
						${after("PAGE")}
						UNION ALL
						SELECT anchor.*, 'PREVIOUS'::TEXT AS "marker" FROM anchor
					)`;
        case "BEFORE":
          return sql`${anchorCte}, selected AS (
						${before("PAGE")}
						UNION ALL
						SELECT anchor.*, 'NEXT'::TEXT AS "marker" FROM anchor
					)`;
        case "AROUND":
          return sql`${anchorCte}, selected AS (
						${before("BEFORE")}
						UNION ALL
						SELECT anchor.*, 'FOCUS'::TEXT AS "marker" FROM anchor
						UNION ALL
						${after("AFTER")}
					)`;
      }
    })();

    const rows = await this.#queryRows(
      markedCommentRowSchema,
      sql`
			WITH ${selectionCte}
			SELECT selected."marker", ${commentColumns(sql`selected`)}
			FROM selected
			${commentJoins(sql`selected`)}
			ORDER BY selected."createdAt" ASC, selected."id" ASC
		`,
    );

    if (params.mode !== "INITIAL" && rows.length === 0) {
      return null;
    }

    const window = toTodoCommentKeysetWindow(
      toMarkedRecords(rows, toCommentRecord),
      toPageMode(params.mode),
      params.size,
    );
    return { items: window.items, hasPrevious: window.hasPrevious, hasNext: window.hasNext };
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
      params.anchorPosition == null || params.anchorThreadId == null
        ? null
        : { position: params.anchorPosition, threadId: params.anchorThreadId };
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
    const rows = await this.#queryRows(
      markedRootRowSchema,
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
				${commentColumns(sql`selected`)},
				${selectedRootLikeCountAtBoundary} AS "rootLikeCount",
				${selectedRootReplyCountAtBoundary} AS "rootReplyCount"
			FROM selected
			${commentJoins(sql`selected`)}
			ORDER BY ${selectedOrder}
		`,
    );

    if (params.mode !== "INITIAL" && rows.length === 0) {
      return null;
    }

    return toTodoCommentKeysetWindow(
      toMarkedRecords(rows, toConversationRecord),
      params.mode,
      params.size,
    );
  }

  async findLikedCommentIds(commentIds: readonly string[], viewerId: string): Promise<Set<string>> {
    if (commentIds.length === 0) {
      return new Set();
    }

    const likes = await this.#db.query.todoCommentLike.findMany({
      columns: { commentId: true },
      where: { commentId: { in: [...commentIds] }, userId: viewerId, isActive: true },
    });

    return new Set(likes.map((like) => like.commentId));
  }

  async findUserDisplayName(userId: string): Promise<string | null> {
    const profile = await this.#db.query.userProfile.findFirst({
      columns: { name: true },
      where: { userId },
    });

    return profile?.name ?? null;
  }
}
