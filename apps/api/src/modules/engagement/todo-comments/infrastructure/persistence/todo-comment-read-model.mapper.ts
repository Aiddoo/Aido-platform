import type { TransactionHost } from "@nestjs-cls/transactional";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";

import { userDisplayProfiles } from "#api/modules/identity/users/identity-users-queries.public";
import { todoOwners } from "#api/modules/planning/todos/planning-todos-queries.public";
import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { todoComment } from "#api/platform/database/schema/index";

import type {
  TodoCommentParticipantAuthorReadModel,
  TodoCommentReadModel,
  TodoCommentRootPositionReadModel,
} from "../../application/read-models/todo-comment.read-model.js";
import { DELETED_COMMENT_AUTHOR } from "../../domain/todo-comments.constants.js";

export type TodoCommentDatabase = TransactionHost<DrizzleTransactionalAdapter>["tx"];

// 응답 칸을 붙이는 LEFT JOIN 네 개의 별칭. 모든 댓글 조회가 같은 이름으로 붙인다
export const commentTodo = todoOwners("comment_todo");
export const commentAuthor = userDisplayProfiles("comment_author");
export const replyTarget = alias(todoComment, "reply_target");
export const replyTargetAuthor = userDisplayProfiles("reply_target_author");
export const candidateComment = alias(todoComment, "candidate");
export const anchorComment = alias(todoComment, "anchor_comment");

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
export type CommentSource = Record<CommentColumnName, AnyPgColumn>;

// Drizzle select는 인덱스 시그니처가 있는 객체 타입만 받아 interface 대신 type으로 둔다
type CommentProjection<TSource extends CommentSource> = {
  readonly commentId: TSource["id"];
  readonly todoId: TSource["todoId"];
  readonly threadCommentId: TSource["parentId"];
  readonly replyToCommentId: TSource["replyToCommentId"];
  readonly authorId: TSource["authorId"];
  readonly authorName: typeof commentAuthor.name;
  readonly authorUserTag: typeof commentAuthor.userTag;
  readonly authorProfileImage: typeof commentAuthor.profileImage;
  readonly replyToAuthorId: typeof replyTarget.authorId;
  readonly replyToAuthorName: typeof replyTargetAuthor.name;
  readonly replyToAuthorUserTag: typeof replyTargetAuthor.userTag;
  readonly todoOwnerId: typeof commentTodo.ownerId;
  readonly content: TSource["content"];
  readonly likeCount: TSource["likeCount"];
  readonly replyCount: TSource["replyCount"];
  readonly deletedAt: TSource["deletedAt"];
  readonly editedAt: TSource["editedAt"];
  readonly createdAt: TSource["createdAt"];
};

/** 조회가 돌려주는 댓글 한 행. LEFT JOIN LATERAL로 비어 있을 수 있어 모든 칸이 null일 수 있다 */
export interface TodoCommentProjectionRow {
  readonly commentId: string | null;
  readonly todoId: number | null;
  readonly threadCommentId: string | null;
  readonly replyToCommentId: string | null;
  readonly authorId: string | null;
  readonly authorName: string | null;
  readonly authorUserTag: string | null;
  readonly authorProfileImage: string | null;
  readonly replyToAuthorId: string | null;
  readonly replyToAuthorName: string | null;
  readonly replyToAuthorUserTag: string | null;
  readonly todoOwnerId: string | null;
  readonly content: string | null;
  readonly likeCount: number | null;
  readonly replyCount: number | null;
  readonly deletedAt: Temporal.Instant | null;
  readonly editedAt: Temporal.Instant | null;
  readonly createdAt: Temporal.Instant | null;
}

export interface TodoCommentParticipantRow {
  readonly participantAuthorId: string | null;
  readonly participantAuthorName: string | null;
  readonly participantAuthorUserTag: string | null;
  readonly participantAuthorProfileImage: string | null;
  readonly todoOwnerId: string | null;
}

/** 댓글 응답에 필요한 TodoComment 칸. 키를 컬럼 이름과 같게 두어 CTE·UNION에서도 같은 이름으로 읽는다 */
export function columnsOf<TSource extends CommentSource>(
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

/** 작성자·답글 대상·할 일 주인을 붙인 응답 칸. 쿼리마다 같은 LEFT JOIN 네 개로 붙인다 */
export function projectionOf<TSource extends CommentSource>(
  source: TSource,
): CommentProjection<TSource> {
  return {
    commentId: source.id,
    todoId: source.todoId,
    threadCommentId: source.parentId,
    replyToCommentId: source.replyToCommentId,
    authorId: source.authorId,
    authorName: commentAuthor.name,
    authorUserTag: commentAuthor.userTag,
    authorProfileImage: commentAuthor.profileImage,
    replyToAuthorId: replyTarget.authorId,
    replyToAuthorName: replyTargetAuthor.name,
    replyToAuthorUserTag: replyTargetAuthor.userTag,
    todoOwnerId: commentTodo.ownerId,
    content: source.content,
    likeCount: source.likeCount,
    replyCount: source.replyCount,
    deletedAt: source.deletedAt,
    editedAt: source.editedAt,
    createdAt: source.createdAt,
  };
}

/** 이름이 없는 사용자는 Aido ID(userTag)로 보인다. 지운 계정의 글을 넘겨받은 시스템 작성자는 표시 이름이 없다 */
export function toDisplayName(author: {
  readonly userId: string | null;
  readonly name: string | null;
  readonly userTag: string | null;
}): string | null {
  if (author.userId == null || author.userId === DELETED_COMMENT_AUTHOR.id) {
    return null;
  }
  return author.name ?? author.userTag;
}

function requireValue<TValue>(value: TValue | null, field: string): TValue {
  if (value == null) {
    throw new Error(`Todo comment projection is missing ${field}`);
  }
  return value;
}

/** 글 id가 없으면 LEFT JOIN으로 비어 있는 행이다 */
export function toTodoCommentReadModel(row: TodoCommentProjectionRow): TodoCommentReadModel | null {
  if (row.commentId == null) {
    return null;
  }
  return {
    id: row.commentId,
    todoId: requireValue(row.todoId, "todoId"),
    threadCommentId: row.threadCommentId,
    replyToCommentId: row.replyToCommentId,
    replyToAuthorId: row.replyToAuthorId,
    replyToAuthorName: toDisplayName({
      userId: row.replyToAuthorId,
      name: row.replyToAuthorName,
      userTag: row.replyToAuthorUserTag,
    }),
    authorId: requireValue(row.authorId, "authorId"),
    authorName: toDisplayName({
      userId: row.authorId,
      name: row.authorName,
      userTag: row.authorUserTag,
    }),
    authorUserTag: row.authorUserTag,
    authorProfileImage: row.authorProfileImage,
    todoOwnerId: requireValue(row.todoOwnerId, "todoOwnerId"),
    content: row.content,
    likeCount: requireValue(row.likeCount, "likeCount"),
    replyCount: requireValue(row.replyCount, "replyCount"),
    deletedAt: row.deletedAt,
    editedAt: row.editedAt,
    createdAt: requireValue(row.createdAt, "createdAt"),
  };
}

export function requireTodoCommentReadModel(row: TodoCommentProjectionRow): TodoCommentReadModel {
  return requireRecord(toTodoCommentReadModel(row));
}

export function toTodoCommentParticipantAuthor(
  row: TodoCommentParticipantRow,
): TodoCommentParticipantAuthorReadModel | null {
  if (row.participantAuthorId == null) {
    return null;
  }
  return {
    id: row.participantAuthorId,
    name: toDisplayName({
      userId: row.participantAuthorId,
      name: row.participantAuthorName,
      userTag: row.participantAuthorUserTag,
    }),
    userTag: row.participantAuthorUserTag,
    profileImage: row.participantAuthorProfileImage,
    isTodoOwner: row.participantAuthorId === row.todoOwnerId,
  };
}

export function toRootPosition(row: {
  readonly rootLikeCount: number;
  readonly rootReplyCount: number;
}): TodoCommentRootPositionReadModel {
  return { rootLikeCount: row.rootLikeCount, rootReplyCount: row.rootReplyCount };
}
