import { TODO_COMMENT_LIMITS, TODO_COMMENT_SORT, type TodoCommentSort } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, min, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { userDisplayProfiles } from "#api/modules/identity/users/identity-users-queries.public";
import { todoOwners } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { type KeysetOperand, tupleGreaterThan, tupleLessThan } from "#api/platform/database/keyset";
import { todoComment } from "#api/platform/database/schema/index";

import type {
  ListTodoCommentThreadsParams,
  TodoCommentThreadReaderPort,
} from "../../application/ports/todo-comment-thread.reader.port.js";
import type {
  TodoCommentParticipantAuthorReadModel,
  TodoCommentReadModel,
  TodoCommentThreadItemReadModel,
  TodoCommentThreadReadModel,
  TodoCommentWindowReadModel,
} from "../../application/read-models/todo-comment.read-model.js";
import {
  anchorComment,
  commentAuthor,
  candidateComment,
  type CommentSource,
  columnsOf,
  commentTodo,
  projectionOf,
  replyTarget,
  replyTargetAuthor,
  requireTodoCommentReadModel,
  type TodoCommentDatabase,
  toRootPosition,
  toTodoCommentParticipantAuthor,
  toTodoCommentReadModel,
} from "./todo-comment-read-model.mapper.js";
import { toTodoCommentKeysetWindow } from "./todo-comment-window.mapper.js";

const requestedComment = alias(todoComment, "requested");
const previewComment = alias(todoComment, "preview");
const participantComment = alias(todoComment, "participant");
const ownerTodo = todoOwners("owner_todo");
const participantProfile = userDisplayProfiles("participant_profile");

interface ThreadSummary {
  readonly previewReply: TodoCommentReadModel | null;
  readonly participantAuthors: TodoCommentParticipantAuthorReadModel[];
}

/** 묶음 머리는 최신순이면 작성 시각, 인기순이면 좋아요·답글 수가 앞선다 */
function rootSortColumns(
  source: Pick<CommentSource, "likeCount" | "replyCount" | "createdAt" | "id">,
  sort: TodoCommentSort,
): KeysetOperand[] {
  return sort === TODO_COMMENT_SORT.LATEST
    ? [source.createdAt, source.id]
    : [source.likeCount, source.replyCount, source.createdAt, source.id];
}

function threadAnchorOf(database: TodoCommentDatabase, params: ListTodoCommentThreadsParams) {
  return database.$with("anchor").as(
    database
      .select(columnsOf(anchorComment))
      .from(anchorComment)
      .where(
        and(
          eq(anchorComment.todoId, params.todoId.value),
          eq(anchorComment.id, params.anchorCommentId?.value ?? ""),
          isNull(anchorComment.parentId),
          params.mode === "ANCHOR"
            ? or(isNull(anchorComment.deletedAt), gt(anchorComment.replyCount, 0))
            : undefined,
        ),
      ),
  );
}

/** 기준 묶음 앞뒤의 묶음 머리를 한 행 더 읽는다. 인기 점수는 cursor에 담긴 값을 경계로 쓴다 */
function selectedThreadsOf(
  database: TodoCommentDatabase,
  params: ListTodoCommentThreadsParams,
  anchor: ReturnType<typeof threadAnchorOf>,
) {
  const visibleThread = and(
    eq(candidateComment.todoId, params.todoId.value),
    isNull(candidateComment.parentId),
    or(isNull(candidateComment.deletedAt), gt(candidateComment.replyCount, 0)),
  );
  // 바뀌지 않는 createdAt·id는 기준 행에서 읽는다
  const boundary =
    params.sort === TODO_COMMENT_SORT.LATEST
      ? [anchor.createdAt, anchor.id]
      : [
          params.anchorPosition?.rootLikeCount ?? anchor.likeCount,
          params.anchorPosition?.rootReplyCount ?? anchor.replyCount,
          anchor.createdAt,
          anchor.id,
        ];
  const candidateKey = rootSortColumns(candidateComment, params.sort);
  const displayOrder = candidateKey.map((column) => desc(column));
  const reverseOrder = candidateKey.map((column) => asc(column));
  const after = () =>
    database
      .select(columnsOf(candidateComment))
      .from(candidateComment)
      .innerJoin(anchor, tupleLessThan(candidateKey, boundary))
      .where(visibleThread)
      .orderBy(...displayOrder)
      .limit(params.size + 1);
  const before = () =>
    database
      .select(columnsOf(candidateComment))
      .from(candidateComment)
      .innerJoin(anchor, tupleGreaterThan(candidateKey, boundary))
      .where(visibleThread)
      .orderBy(...reverseOrder)
      .limit(params.size + 1);
  const anchorRow = () => database.select(columnsOf(anchor)).from(anchor);
  return database.$with("selected").as(() => {
    switch (params.mode) {
      case "INITIAL":
        return database
          .select(columnsOf(candidateComment))
          .from(candidateComment)
          .where(visibleThread)
          .orderBy(...displayOrder)
          .limit(params.size + 1);
      case "AFTER":
        return after().unionAll(anchorRow());
      case "BEFORE":
        return before().unionAll(anchorRow());
      case "ANCHOR":
        return before().unionAll(anchorRow()).unionAll(after());
    }
  });
}

/** 할 일 주인의 답글을 먼저, 없으면 가장 먼저 쓴 답글을 대표로 고른다 */
function previewReplyOf(database: TodoCommentDatabase) {
  return database
    .select(columnsOf(previewComment))
    .from(previewComment)
    .where(and(eq(previewComment.parentId, requestedComment.id), isNull(previewComment.deletedAt)))
    .orderBy(
      desc(eq(previewComment.authorId, ownerTodo.ownerId)),
      asc(previewComment.createdAt),
      asc(previewComment.id),
    )
    .limit(1)
    .as("preview_reply");
}

/** 답글을 쓴 사람. 할 일 주인을 먼저, 그다음 처음 답한 순서로 몇 명만 고른다 */
function participantAuthorsOf(database: TodoCommentDatabase) {
  const firstRepliedAt = min(participantComment.createdAt);
  return database
    .select({
      authorId: participantComment.authorId,
      firstRepliedAt: firstRepliedAt.as("firstRepliedAt"),
    })
    .from(participantComment)
    .where(
      and(
        eq(participantComment.parentId, requestedComment.id),
        isNull(participantComment.deletedAt),
      ),
    )
    .groupBy(participantComment.authorId)
    .orderBy(
      desc(eq(participantComment.authorId, ownerTodo.ownerId)),
      asc(firstRepliedAt),
      asc(participantComment.authorId),
    )
    .limit(TODO_COMMENT_LIMITS.OVERVIEW_PARTICIPANT_MAX_SIZE)
    .as("participant_author");
}

@Injectable()
export class DrizzleTodoCommentThreadReader implements TodoCommentThreadReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  /** 묶음 머리 keyset을 읽고, 고른 묶음마다 대표 답글과 참여자를 LATERAL로 한 번에 붙인다 */
  async findThreadWindow(
    params: ListTodoCommentThreadsParams,
  ): Promise<TodoCommentWindowReadModel<TodoCommentThreadItemReadModel> | null> {
    const window = await this.#listThreadComments(params);
    if (window == null) {
      return null;
    }
    const summaries = await this.#findThreadSummaries(
      params.todoId.value,
      window.items.map((comment) => comment.id),
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
  ): Promise<TodoCommentWindowReadModel<TodoCommentThreadReadModel> | null> {
    if (params.mode !== "INITIAL" && params.anchorCommentId == null) {
      return null;
    }
    const database = this.#db;
    const anchor = threadAnchorOf(database, params);
    const selected = selectedThreadsOf(database, params, anchor);
    const source = columnsOf(selected);
    const rows = await (
      params.mode === "INITIAL" ? database.with(selected) : database.with(anchor, selected)
    )
      .select(projectionOf(source))
      .from(selected)
      .leftJoin(commentTodo, eq(commentTodo.todoId, source.todoId))
      .leftJoin(commentAuthor, eq(commentAuthor.userId, source.authorId))
      .leftJoin(replyTarget, eq(replyTarget.id, source.replyToCommentId))
      .leftJoin(replyTargetAuthor, eq(replyTargetAuthor.userId, replyTarget.authorId))
      .orderBy(...rootSortColumns(selected, params.sort).map((column) => desc(column)));
    if (params.mode !== "INITIAL" && rows.length === 0) {
      return null;
    }
    const items = rows.map((row): TodoCommentThreadReadModel => {
      const comment = requireTodoCommentReadModel(row);
      return {
        ...comment,
        threadPosition: toRootPosition({
          rootLikeCount: comment.likeCount,
          rootReplyCount: comment.replyCount,
        }),
      };
    });
    return toTodoCommentKeysetWindow({
      items,
      mode: params.mode === "ANCHOR" ? "FOCUS" : params.mode,
      anchorId: params.anchorCommentId?.value,
      size: params.size,
    });
  }

  async #findThreadSummaries(
    todoId: number,
    threadCommentIds: readonly string[],
  ): Promise<Map<string, ThreadSummary>> {
    if (threadCommentIds.length === 0) {
      return new Map();
    }
    const database = this.#db;
    const preview = previewReplyOf(database);
    const participant = participantAuthorsOf(database);
    const previewSource = columnsOf(preview);
    const rows = await database
      .select({
        threadCommentId: requestedComment.id,
        preview: projectionOf(previewSource),
        participantAuthorId: participant.authorId,
        participantAuthorName: participantProfile.name,
        participantAuthorUserTag: participantProfile.userTag,
        participantAuthorProfileImage: participantProfile.profileImage,
        ownerId: ownerTodo.ownerId,
      })
      .from(requestedComment)
      .innerJoin(ownerTodo, eq(ownerTodo.todoId, requestedComment.todoId))
      .leftJoinLateral(preview, eq(preview.parentId, requestedComment.id))
      .leftJoin(commentTodo, eq(commentTodo.todoId, previewSource.todoId))
      .leftJoin(commentAuthor, eq(commentAuthor.userId, previewSource.authorId))
      .leftJoin(replyTarget, eq(replyTarget.id, previewSource.replyToCommentId))
      .leftJoin(replyTargetAuthor, eq(replyTargetAuthor.userId, replyTarget.authorId))
      .leftJoinLateral(participant, isNotNull(participant.authorId))
      .leftJoin(participantProfile, eq(participantProfile.userId, participant.authorId))
      .where(
        and(
          eq(requestedComment.todoId, todoId),
          inArray(requestedComment.id, [...threadCommentIds]),
        ),
      )
      .orderBy(
        asc(requestedComment.id),
        desc(eq(participant.authorId, ownerTodo.ownerId)),
        asc(participant.firstRepliedAt),
        asc(participant.authorId),
      );

    const summaries = new Map<string, ThreadSummary>();
    for (const row of rows) {
      const participantAuthor = toTodoCommentParticipantAuthor({
        ...row,
        todoOwnerId: row.ownerId,
      });
      const summary = summaries.get(row.threadCommentId) ?? {
        previewReply: toTodoCommentReadModel(row.preview),
        participantAuthors: [],
      };
      if (participantAuthor != null) {
        summary.participantAuthors.push(participantAuthor);
      }
      summaries.set(row.threadCommentId, summary);
    }
    return summaries;
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
