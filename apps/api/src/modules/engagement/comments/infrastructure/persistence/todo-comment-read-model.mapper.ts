import type {
  TodoCommentParticipantAuthorReadModel,
  TodoCommentReadModel,
  TodoCommentRootPosition,
} from "../../application/read-models/todo-comment.read-model.js";
import { DELETED_COMMENT_AUTHOR } from "../../domain/comments.constants.js";

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
    throw new Error(`댓글 조회 결과에 ${field} 값이 없습니다.`);
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
}): TodoCommentRootPosition {
  return { rootLikeCount: row.rootLikeCount, rootReplyCount: row.rootReplyCount };
}
