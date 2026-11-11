import { TODO_COMMENT_LIMITS, TODO_COMMENT_SORT, type TodoCommentSort } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  min,
  ne,
  or,
  type SQL,
} from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";

import {
  type TodoId,
  TodoDetailsReaderPort,
} from "#api/modules/planning/todos/planning-todo-queries.public";
import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { type KeysetOperand, tupleGreaterThan, tupleLessThan } from "#api/platform/database/keyset";
import { todo, todoComment, user, userProfile } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  type ListTodoCommentRepliesParams,
  type ListTodoCommentThreadsParams,
  type ListTodoConversationParams,
  TodoCommentReaderPort,
} from "../../application/ports/todo-comment.reader.port.js";
import type {
  TodoCommentParticipantAuthorReadModel,
  TodoCommentReadModel,
  TodoCommentRootPosition,
  TodoCommentThreadItemReadModel,
  TodoCommentThreadReadModel,
  TodoCommentWindow,
  TodoConversationReadModel,
  TodoConversationWindow,
  TodoDetailsReadModel,
} from "../../application/read-models/todo-comment.read-model.js";
import type { TodoCommentId } from "../../domain/todo-comment-id.vo.js";
import {
  toRootPosition,
  toTodoCommentParticipantAuthor,
  toTodoCommentReadModel,
  type TodoCommentProjectionRow,
} from "./todo-comment-read-model.mapper.js";
import { toTodoCommentKeysetWindow } from "./todo-comment-window.mapper.js";

const commentTodo = alias(todo, "comment_todo");
const authorProfile = alias(userProfile, "author_profile");
const authorUser = alias(user, "author_user");
const replyTarget = alias(todoComment, "reply_target");
const replyTargetProfile = alias(userProfile, "reply_target_profile");
const candidateComment = alias(todoComment, "candidate");
const anchorComment = alias(todoComment, "anchor_comment");
const headComment = alias(todoComment, "head");
const replyComment = alias(todoComment, "reply");
const focusComment = alias(todoComment, "focus");
const requestedComment = alias(todoComment, "requested");
const previewComment = alias(todoComment, "preview");
const participantComment = alias(todoComment, "participant");
const ownerTodo = alias(todo, "owner_todo");
const participantProfile = alias(userProfile, "participant_profile");
const participantUser = alias(user, "participant_user");

const COMMENT_COLUMN_NAMES = [
  "id",
  "todoId",
  "parentId",
  "replyToCommentId",
  "authorId",
  "content",
  "likeCount",
  "replyCount",
  "deletedAt",
  "editedAt",
  "createdAt",
] as const;

type CommentColumnName = (typeof COMMENT_COLUMN_NAMES)[number];
/** 대화 tree 행. 묶음 머리 칸을 함께 싣는다 */
type TreeSource = Record<
  | "id"
  | "parentId"
  | "createdAt"
  | "threadId"
  | "rootLikeCount"
  | "rootReplyCount"
  | "rootCreatedAt",
  AnyPgColumn
>;
type CommentSource = Record<CommentColumnName, AnyPgColumn>;

// Drizzle select는 인덱스 시그니처가 있는 객체 타입만 받아 interface 대신 type으로 둔다
type CommentProjection<TSource extends CommentSource> = {
  readonly commentId: TSource["id"];
  readonly todoId: TSource["todoId"];
  readonly threadCommentId: TSource["parentId"];
  readonly replyToCommentId: TSource["replyToCommentId"];
  readonly authorId: TSource["authorId"];
  readonly authorName: typeof authorProfile.name;
  readonly authorUserTag: typeof authorUser.userTag;
  readonly authorProfileImage: typeof authorProfile.profileImage;
  readonly replyToAuthorId: typeof replyTarget.authorId;
  readonly replyToAuthorName: typeof replyTargetProfile.name;
  readonly todoOwnerId: typeof commentTodo.userId;
  readonly content: TSource["content"];
  readonly likeCount: TSource["likeCount"];
  readonly replyCount: TSource["replyCount"];
  readonly deletedAt: TSource["deletedAt"];
  readonly editedAt: TSource["editedAt"];
  readonly createdAt: TSource["createdAt"];
};

/** 댓글 응답에 필요한 TodoComment 칸. 키를 컬럼 이름과 같게 두어 CTE·UNION에서도 같은 이름으로 읽는다 */
function columnsOf<TSource extends CommentSource>(
  source: TSource,
): Pick<TSource, CommentColumnName> {
  return {
    id: source.id,
    todoId: source.todoId,
    parentId: source.parentId,
    replyToCommentId: source.replyToCommentId,
    authorId: source.authorId,
    content: source.content,
    likeCount: source.likeCount,
    replyCount: source.replyCount,
    deletedAt: source.deletedAt,
    editedAt: source.editedAt,
    createdAt: source.createdAt,
  };
}

/** 작성자·답글 대상·할 일 주인을 붙인 응답 칸. 쿼리마다 같은 LEFT JOIN 다섯 개로 붙인다 */
function projectionOf<TSource extends CommentSource>(source: TSource): CommentProjection<TSource> {
  return {
    commentId: source.id,
    todoId: source.todoId,
    threadCommentId: source.parentId,
    replyToCommentId: source.replyToCommentId,
    authorId: source.authorId,
    authorName: authorProfile.name,
    authorUserTag: authorUser.userTag,
    authorProfileImage: authorProfile.profileImage,
    replyToAuthorId: replyTarget.authorId,
    replyToAuthorName: replyTargetProfile.name,
    todoOwnerId: commentTodo.userId,
    content: source.content,
    likeCount: source.likeCount,
    replyCount: source.replyCount,
    deletedAt: source.deletedAt,
    editedAt: source.editedAt,
    createdAt: source.createdAt,
  };
}

function requireReadModel(row: TodoCommentProjectionRow): TodoCommentReadModel {
  return requireRecord(toTodoCommentReadModel(row));
}

/** 묶음 머리·대화는 최신순이면 작성 시각, 인기순이면 좋아요·답글 수가 앞선다 */
function rootSortColumns(
  source: Pick<CommentSource, "likeCount" | "replyCount" | "createdAt" | "id">,
  sort: TodoCommentSort,
): KeysetOperand[] {
  return sort === TODO_COMMENT_SORT.LATEST
    ? [source.createdAt, source.id]
    : [source.likeCount, source.replyCount, source.createdAt, source.id];
}

interface ThreadSummary {
  readonly previewReply: TodoCommentReadModel | null;
  readonly participantAuthors: TodoCommentParticipantAuthorReadModel[];
}

@Injectable()
export class DrizzleTodoCommentReader implements TodoCommentReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #todoDetails: Pick<TodoDetailsReaderPort, "findAccess" | "findDetails">;

  constructor(
    txHost: TransactionHost<DrizzleTransactionalAdapter>,
    todoDetails: TodoDetailsReaderPort,
  ) {
    this.#txHost = txHost;
    this.#todoDetails = todoDetails;
  }

  get #db() {
    return this.#txHost.tx;
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

  async findAccessibleTodoOwnerId(todoId: TodoId, viewerId: UserId): Promise<string | null> {
    const access = await this.#todoDetails.findAccess(todoId);
    if (access == null) {
      return null;
    }
    if (access.ownerId === viewerId.value) {
      return access.ownerId;
    }
    if (access.visibility !== "PUBLIC") {
      return null;
    }
    return (await this.#isAcceptedFriend(access.ownerId, viewerId.value)) ? access.ownerId : null;
  }

  async findAccessibleTodoDetails(
    todoId: TodoId,
    viewerId: UserId,
  ): Promise<TodoDetailsReadModel | null> {
    const details = await this.#todoDetails.findDetails(todoId);
    if (details == null) {
      return null;
    }
    const { todo } = details;
    const isOwner = todo.userId === viewerId.value;
    const canAccess =
      isOwner ||
      (todo.visibility === "PUBLIC" && (await this.#isAcceptedFriend(todo.userId, viewerId.value)));
    if (!canAccess) {
      return null;
    }
    const owner = requireRecord(
      await this.#db.query.user.findFirst({
        columns: { id: true },
        where: { id: todo.userId },
        with: { profile: { columns: { name: true, profileImage: true } } },
      }),
    );
    return {
      todo,
      owner: {
        id: owner.id,
        name: owner.profile?.name ?? null,
        profileImage: owner.profile?.profileImage ?? null,
      },
      viewCount: details.viewCount,
      commentCount: todo.commentCount,
      isOwner,
    };
  }

  async findComment(
    todoId: TodoId,
    commentId: TodoCommentId,
  ): Promise<TodoCommentReadModel | null> {
    const [comment] = await this.listComments(todoId, [commentId]);
    return comment ?? null;
  }

  async listComments(
    todoId: TodoId,
    commentIds: readonly TodoCommentId[],
  ): Promise<TodoCommentReadModel[]> {
    if (commentIds.length === 0) {
      return [];
    }
    const ids = commentIds.map((commentId) => commentId.value);
    const source = columnsOf(anchorComment);
    const rows = await this.#db
      .select(projectionOf(source))
      .from(anchorComment)
      .leftJoin(commentTodo, eq(commentTodo.id, source.todoId))
      .leftJoin(authorProfile, eq(authorProfile.userId, source.authorId))
      .leftJoin(authorUser, eq(authorUser.id, source.authorId))
      .leftJoin(replyTarget, eq(replyTarget.id, source.replyToCommentId))
      .leftJoin(replyTargetProfile, eq(replyTargetProfile.userId, replyTarget.authorId))
      .where(and(eq(anchorComment.todoId, todoId.value), inArray(anchorComment.id, ids)));
    const commentsById = new Map(rows.map((row) => [row.commentId, requireReadModel(row)]));
    return ids.flatMap((commentId) => {
      const comment = commentsById.get(commentId);
      return comment == null ? [] : [comment];
    });
  }

  /** 묶음 머리 keyset을 읽고, 고른 묶음마다 대표 답글과 참여자를 LATERAL로 한 번에 붙인다 */
  async listThreads(
    params: ListTodoCommentThreadsParams,
  ): Promise<TodoCommentWindow<TodoCommentThreadItemReadModel> | null> {
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
  ): Promise<TodoCommentWindow<TodoCommentThreadReadModel> | null> {
    if (params.mode !== "INITIAL" && params.anchorCommentId == null) {
      return null;
    }
    const db = this.#db;
    const isLatest = params.sort === TODO_COMMENT_SORT.LATEST;
    const visibleThread = and(
      eq(candidateComment.todoId, params.todoId.value),
      isNull(candidateComment.parentId),
      or(isNull(candidateComment.deletedAt), gt(candidateComment.replyCount, 0)),
    );
    const anchor = db.$with("anchor").as(
      db
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
    // 인기 점수는 cursor에 담긴 값을 경계로 쓰고, 바뀌지 않는 createdAt·id는 기준 행에서 읽는다
    const boundary = isLatest
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
      db
        .select(columnsOf(candidateComment))
        .from(candidateComment)
        .innerJoin(anchor, tupleLessThan(candidateKey, boundary))
        .where(visibleThread)
        .orderBy(...displayOrder)
        .limit(params.size + 1);
    const before = () =>
      db
        .select(columnsOf(candidateComment))
        .from(candidateComment)
        .innerJoin(anchor, tupleGreaterThan(candidateKey, boundary))
        .where(visibleThread)
        .orderBy(...reverseOrder)
        .limit(params.size + 1);
    const anchorRow = () => db.select(columnsOf(anchor)).from(anchor);
    const selected = db.$with("selected").as(() => {
      switch (params.mode) {
        case "INITIAL":
          return db
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
    const source = columnsOf(selected);
    const rows = await (params.mode === "INITIAL" ? db.with(selected) : db.with(anchor, selected))
      .select(projectionOf(source))
      .from(selected)
      .leftJoin(commentTodo, eq(commentTodo.id, source.todoId))
      .leftJoin(authorProfile, eq(authorProfile.userId, source.authorId))
      .leftJoin(authorUser, eq(authorUser.id, source.authorId))
      .leftJoin(replyTarget, eq(replyTarget.id, source.replyToCommentId))
      .leftJoin(replyTargetProfile, eq(replyTargetProfile.userId, replyTarget.authorId))
      .orderBy(...rootSortColumns(selected, params.sort).map((column) => desc(column)));
    if (params.mode !== "INITIAL" && rows.length === 0) {
      return null;
    }
    const items = rows.map((row): TodoCommentThreadReadModel => {
      const comment = requireReadModel(row);
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
    const db = this.#db;
    // 할 일 주인의 답글을 먼저, 없으면 가장 먼저 쓴 답글을 대표로 고른다
    const preview = db
      .select(columnsOf(previewComment))
      .from(previewComment)
      .where(
        and(eq(previewComment.parentId, requestedComment.id), isNull(previewComment.deletedAt)),
      )
      .orderBy(
        desc(eq(previewComment.authorId, ownerTodo.userId)),
        asc(previewComment.createdAt),
        asc(previewComment.id),
      )
      .limit(1)
      .as("preview_reply");
    const firstRepliedAt = min(participantComment.createdAt);
    const participant = db
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
        desc(eq(participantComment.authorId, ownerTodo.userId)),
        asc(firstRepliedAt),
        asc(participantComment.authorId),
      )
      .limit(TODO_COMMENT_LIMITS.OVERVIEW_PARTICIPANT_MAX_SIZE)
      .as("participant_author");
    const previewSource = columnsOf(preview);
    const rows = await db
      .select({
        threadCommentId: requestedComment.id,
        preview: projectionOf(previewSource),
        participantAuthorId: participant.authorId,
        participantAuthorName: participantProfile.name,
        participantAuthorUserTag: participantUser.userTag,
        participantAuthorProfileImage: participantProfile.profileImage,
        ownerId: ownerTodo.userId,
      })
      .from(requestedComment)
      .innerJoin(ownerTodo, eq(ownerTodo.id, requestedComment.todoId))
      .leftJoinLateral(preview, eq(preview.parentId, requestedComment.id))
      .leftJoin(commentTodo, eq(commentTodo.id, previewSource.todoId))
      .leftJoin(authorProfile, eq(authorProfile.userId, previewSource.authorId))
      .leftJoin(authorUser, eq(authorUser.id, previewSource.authorId))
      .leftJoin(replyTarget, eq(replyTarget.id, previewSource.replyToCommentId))
      .leftJoin(replyTargetProfile, eq(replyTargetProfile.userId, replyTarget.authorId))
      .leftJoinLateral(participant, isNotNull(participant.authorId))
      .leftJoin(participantProfile, eq(participantProfile.userId, participant.authorId))
      .leftJoin(participantUser, eq(participantUser.id, participant.authorId))
      .where(
        and(
          eq(requestedComment.todoId, todoId),
          inArray(requestedComment.id, [...threadCommentIds]),
        ),
      )
      .orderBy(
        asc(requestedComment.id),
        desc(eq(participant.authorId, ownerTodo.userId)),
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

  /** 묶음 하나의 답글을 작성 순으로 읽는다. 지운 답글은 목록에서 빠지지만 cursor 위치로는 남는다 */
  async listReplies(
    params: ListTodoCommentRepliesParams,
  ): Promise<TodoCommentWindow<TodoCommentReadModel> | null> {
    if (params.mode !== "INITIAL" && params.anchorReplyId == null) {
      return null;
    }
    const db = this.#db;
    const visibleReply = and(
      eq(candidateComment.todoId, params.todoId.value),
      eq(candidateComment.parentId, params.threadCommentId.value),
      isNull(candidateComment.deletedAt),
    );
    const anchor = db.$with("anchor").as(
      db
        .select(columnsOf(anchorComment))
        .from(anchorComment)
        .where(
          and(
            eq(anchorComment.todoId, params.todoId.value),
            eq(anchorComment.parentId, params.threadCommentId.value),
            eq(anchorComment.id, params.anchorReplyId?.value ?? ""),
            params.mode === "AROUND" ? isNull(anchorComment.deletedAt) : undefined,
          ),
        ),
    );
    const candidateKey = [candidateComment.createdAt, candidateComment.id];
    const boundary = [anchor.createdAt, anchor.id];
    const writtenOrder = candidateKey.map((column) => asc(column));
    const after = () =>
      db
        .select(columnsOf(candidateComment))
        .from(candidateComment)
        .innerJoin(anchor, tupleGreaterThan(candidateKey, boundary))
        .where(visibleReply)
        .orderBy(...writtenOrder)
        .limit(params.size + 1);
    const before = () =>
      db
        .select(columnsOf(candidateComment))
        .from(candidateComment)
        .innerJoin(anchor, tupleLessThan(candidateKey, boundary))
        .where(visibleReply)
        .orderBy(...candidateKey.map((column) => desc(column)))
        .limit(params.size + 1);
    const anchorRow = () => db.select(columnsOf(anchor)).from(anchor);
    const selected = db.$with("selected").as(() => {
      switch (params.mode) {
        case "INITIAL":
          return db
            .select(columnsOf(candidateComment))
            .from(candidateComment)
            .where(visibleReply)
            .orderBy(...writtenOrder)
            .limit(params.size + 1);
        case "AFTER":
          return after().unionAll(anchorRow());
        case "BEFORE":
          return before().unionAll(anchorRow());
        case "AROUND":
          return before().unionAll(anchorRow()).unionAll(after());
      }
    });
    const source = columnsOf(selected);
    const rows = await (params.mode === "INITIAL" ? db.with(selected) : db.with(anchor, selected))
      .select(projectionOf(source))
      .from(selected)
      .leftJoin(commentTodo, eq(commentTodo.id, source.todoId))
      .leftJoin(authorProfile, eq(authorProfile.userId, source.authorId))
      .leftJoin(authorUser, eq(authorUser.id, source.authorId))
      .leftJoin(replyTarget, eq(replyTarget.id, source.replyToCommentId))
      .leftJoin(replyTargetProfile, eq(replyTargetProfile.userId, replyTarget.authorId))
      .orderBy(asc(selected.createdAt), asc(selected.id));
    if (params.mode !== "INITIAL" && rows.length === 0) {
      return null;
    }
    const window = toTodoCommentKeysetWindow({
      items: rows.map(requireReadModel),
      mode: params.mode === "AROUND" ? "FOCUS" : params.mode,
      anchorId: params.anchorReplyId?.value,
      size: params.size,
    });
    return { items: window.items, hasPrevious: window.hasPrevious, hasNext: window.hasNext };
  }

  /**
   * 묶음은 최신·인기순으로, 묶음 안은 머리 댓글 다음 답글을 작성 순으로 세운다.
   * 묶음 위치와 (답글 여부, createdAt, id)를 keyset으로 비교하고, 경계 뒤 한 행을 더 읽어 연결선 연속성을 확정한다.
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
    const db = this.#db;
    const isLatest = params.sort === TODO_COMMENT_SORT.LATEST;
    // 다음·이전 페이지는 cursor에 담긴 묶음 머리 점수를 경계로 쓴다. 그 묶음의 행은 점수가 바뀌어도 경계 자리에 둔다
    const snapshot =
      params.anchorPosition == null || params.anchorThreadId == null
        ? null
        : { threadId: params.anchorThreadId.value, position: params.anchorPosition };
    const threads = db.$with("threads").as(
      db
        .select(columnsOf(headComment))
        .from(headComment)
        .where(
          and(
            eq(headComment.todoId, params.todoId.value),
            isNull(headComment.parentId),
            this.#conversationThreadCondition(params),
          ),
        ),
    );
    const tree = db.$with("tree").as(
      db
        .select({
          ...columnsOf(threads),
          threadId: threads.id.as("threadId"),
          rootLikeCount: threads.likeCount.as("rootLikeCount"),
          rootReplyCount: threads.replyCount.as("rootReplyCount"),
          rootCreatedAt: threads.createdAt.as("rootCreatedAt"),
        })
        .from(threads)
        .unionAll(
          db
            .select({
              ...columnsOf(replyComment),
              threadId: threads.id.as("threadId"),
              rootLikeCount: threads.likeCount.as("rootLikeCount"),
              rootReplyCount: threads.replyCount.as("rootReplyCount"),
              rootCreatedAt: threads.createdAt.as("rootCreatedAt"),
            })
            .from(threads)
            .innerJoin(replyComment, eq(replyComment.parentId, threads.id)),
        ),
    );
    const anchor = db.$with("anchor").as(
      db
        .select({
          id: tree.id,
          createdAt: tree.createdAt,
          parentId: tree.parentId,
          threadId: tree.threadId,
          rootLikeCount: tree.rootLikeCount,
          rootReplyCount: tree.rootReplyCount,
          rootCreatedAt: tree.rootCreatedAt,
        })
        .from(tree)
        .where(
          and(
            eq(tree.id, params.anchorCommentId?.value ?? ""),
            params.anchorThreadId == null
              ? undefined
              : eq(tree.threadId, params.anchorThreadId.value),
          ),
        ),
    );

    const rootKey = (source: TreeSource): KeysetOperand[] =>
      isLatest
        ? [source.rootCreatedAt, source.threadId]
        : [source.rootLikeCount, source.rootReplyCount, source.rootCreatedAt, source.threadId];
    const threadKey = (source: TreeSource): KeysetOperand[] => [
      isNotNull(source.parentId),
      source.createdAt,
      source.id,
    ];
    const rootBoundary = isLatest
      ? [anchor.rootCreatedAt, anchor.threadId]
      : [
          snapshot?.position.rootLikeCount ?? anchor.rootLikeCount,
          snapshot?.position.rootReplyCount ?? anchor.rootReplyCount,
          anchor.rootCreatedAt,
          anchor.threadId,
        ];
    const threadBoundary = [isNotNull(anchor.parentId), anchor.createdAt, anchor.id];
    const afterAnchor = or(
      and(ne(tree.threadId, anchor.threadId), tupleLessThan(rootKey(tree), rootBoundary)),
      and(eq(tree.threadId, anchor.threadId), tupleGreaterThan(threadKey(tree), threadBoundary)),
    );
    const beforeAnchor = or(
      and(ne(tree.threadId, anchor.threadId), tupleGreaterThan(rootKey(tree), rootBoundary)),
      and(eq(tree.threadId, anchor.threadId), tupleLessThan(threadKey(tree), threadBoundary)),
    );
    const visible = or(isNull(tree.deletedAt), gt(tree.replyCount, 0));
    // 경계 묶음의 행은 cursor의 점수로 경계에 놓이므로, 인기순 다음 페이지는 그 행이 먼저, 이전 페이지는 나중에 온다
    const boundaryThreadFirst = (source: TreeSource, isBoundaryFirst: boolean) =>
      snapshot == null || isLatest
        ? []
        : [
            isBoundaryFirst
              ? desc(eq(source.threadId, snapshot.threadId))
              : asc(eq(source.threadId, snapshot.threadId)),
          ];
    const displayOrder = (source: TreeSource, isBoundaryFirst: boolean) => [
      ...boundaryThreadFirst(source, isBoundaryFirst),
      ...rootKey(source).map((column) => desc(column)),
      ...threadKey(source).map((column) => asc(column)),
    ];
    const reverseOrder = (source: TreeSource) => [
      ...boundaryThreadFirst(source, true),
      ...rootKey(source).map((column) => asc(column)),
      ...threadKey(source).map((column) => desc(column)),
    ];
    const treeColumns = (source: typeof tree) => ({
      ...columnsOf(source),
      threadId: source.threadId,
      rootLikeCount: source.rootLikeCount,
      rootReplyCount: source.rootReplyCount,
      rootCreatedAt: source.rootCreatedAt,
    });
    const page = (condition: SQL | undefined, order: ReturnType<typeof displayOrder>) =>
      db
        .select(treeColumns(tree))
        .from(tree)
        .innerJoin(anchor, condition)
        .where(visible)
        .orderBy(...order)
        .limit(params.size + 1);
    const sameThread = eq(tree.threadId, anchor.threadId);
    const scopeCondition = params.scope === "THREAD" ? sameThread : undefined;
    const anchorRow = () =>
      db.select(treeColumns(tree)).from(tree).innerJoin(anchor, eq(tree.id, anchor.id));
    const selected = db.$with("selected").as(() => {
      switch (params.mode) {
        case "INITIAL":
          return db
            .select(treeColumns(tree))
            .from(tree)
            .where(visible)
            .orderBy(...displayOrder(tree, true))
            .limit(params.size + 1);
        case "AFTER":
          return page(and(scopeCondition, afterAnchor), displayOrder(tree, true)).unionAll(
            anchorRow(),
          );
        case "BEFORE":
          return page(and(scopeCondition, beforeAnchor), reverseOrder(tree)).unionAll(anchorRow());
        case "FOCUS":
          return page(and(sameThread, beforeAnchor), reverseOrder(tree))
            .unionAll(anchorRow())
            .unionAll(page(and(sameThread, afterAnchor), displayOrder(tree, true)));
      }
    });
    const source = columnsOf(selected);
    const rows = await (
      params.mode === "INITIAL"
        ? db.with(threads, tree, selected)
        : db.with(threads, tree, anchor, selected)
    )
      .select({
        ...projectionOf(source),
        threadId: selected.threadId,
        rootLikeCount: selected.rootLikeCount,
        rootReplyCount: selected.rootReplyCount,
      })
      .from(selected)
      .leftJoin(commentTodo, eq(commentTodo.id, source.todoId))
      .leftJoin(authorProfile, eq(authorProfile.userId, source.authorId))
      .leftJoin(authorUser, eq(authorUser.id, source.authorId))
      .leftJoin(replyTarget, eq(replyTarget.id, source.replyToCommentId))
      .leftJoin(replyTargetProfile, eq(replyTargetProfile.userId, replyTarget.authorId))
      .orderBy(...displayOrder(selected, params.mode !== "BEFORE"));
    if (params.mode !== "INITIAL" && rows.length === 0) {
      return null;
    }
    const items = rows.map((row): TodoConversationReadModel => {
      const comment = requireReadModel(row);
      return {
        ...comment,
        conversationPosition: this.#rootPositionAt(row, snapshot),
      };
    });
    const window = toTodoCommentKeysetWindow({
      items,
      mode: params.mode,
      anchorId: params.anchorCommentId?.value,
      size: params.size,
    });
    return {
      items: window.items,
      anchorIndex: window.anchorIndex,
      previousItem: window.previousRecord,
      nextItem: window.nextRecord,
      hasPrevious: window.hasPrevious,
      hasNext: window.hasNext,
    };
  }

  /** focus면 그 글이 속한 묶음, 묶음 범위 cursor면 그 묶음만 읽는다 */
  #conversationThreadCondition(params: ListTodoConversationParams): SQL | undefined {
    if (params.mode === "FOCUS") {
      // 댓글을 열면 그 댓글이, 답글을 열면 그 답글의 묶음 머리가 대상이다
      return or(
        eq(headComment.id, params.anchorCommentId?.value ?? ""),
        inArray(
          headComment.id,
          this.#db
            .select({ id: focusComment.parentId })
            .from(focusComment)
            .where(
              and(
                eq(focusComment.todoId, params.todoId.value),
                eq(focusComment.id, params.anchorCommentId?.value ?? ""),
              ),
            ),
        ),
      );
    }
    return params.scope === "THREAD"
      ? eq(headComment.id, params.anchorThreadId?.value ?? "")
      : undefined;
  }

  #rootPositionAt(
    row: {
      readonly threadId: string;
      readonly rootLikeCount: number;
      readonly rootReplyCount: number;
    },
    snapshot: { readonly threadId: string; readonly position: TodoCommentRootPosition } | null,
  ): TodoCommentRootPosition {
    return snapshot != null && row.threadId === snapshot.threadId
      ? snapshot.position
      : toRootPosition(row);
  }

  async listLikedCommentIds(
    commentIds: readonly TodoCommentId[],
    viewerId: UserId,
  ): Promise<ReadonlySet<string>> {
    if (commentIds.length === 0) {
      return new Set();
    }
    const likes = await this.#db.query.todoCommentLike.findMany({
      columns: { commentId: true },
      where: {
        commentId: { in: commentIds.map((commentId) => commentId.value) },
        userId: viewerId.value,
        isActive: true,
      },
    });
    return new Set(likes.map((like) => like.commentId));
  }

  async findUserDisplayName(userId: UserId): Promise<string | null> {
    const profile = await this.#db.query.userProfile.findFirst({
      columns: { name: true },
      where: { userId: userId.value },
    });
    return profile?.name ?? null;
  }
}
