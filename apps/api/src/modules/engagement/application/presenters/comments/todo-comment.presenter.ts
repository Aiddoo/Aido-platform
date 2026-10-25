import type { TodoComment, TodoCommentAuthor } from "@aido/api";

import { getTodoCommentViewerPermissions } from "../../../domain/policies/comments/todo-comment-permission.policy.js";
import type {
  TodoCommentParticipantAuthorRecord,
  TodoCommentRecord,
} from "../../models/comments/todo-comment.types.js";

const NO_BLOCKED_AUTHORS: ReadonlySet<string> = new Set();

/**
 * viewer와 차단 관계인 작성자의 댓글은 대화 위치만 남기고 삭제된 댓글처럼 가린다.
 * isAuthorBlocked를 모르는 구 앱도 삭제된 댓글로 그려 차단한 사람의 이름·내용이 보이지 않는다.
 */
export function toTodoCommentResponse(
  record: TodoCommentRecord,
  viewerId: string,
  likedCommentIds: ReadonlySet<string>,
  blockedAuthorIds: ReadonlySet<string> = NO_BLOCKED_AUTHORS,
): TodoComment {
  const authorId = record.authorId;
  const isAuthorBlocked = blockedAuthorIds.has(authorId);
  const isHidden = record.deletedAt != null || isAuthorBlocked;
  const isParentAuthorBlocked =
    record.parentAuthorId != null && blockedAuthorIds.has(record.parentAuthorId);
  const viewer = getTodoCommentViewerPermissions({
    isDeleted: isHidden,
    isLiked: likedCommentIds.has(record.id),
    authorId,
    viewerId,
  });

  return {
    id: record.id,
    threadId: record.rootId ?? record.id,
    parentId: record.parentId,
    depth: record.depth,
    author: !isHidden
      ? {
          id: authorId,
          name: record.authorName,
          profileImage: record.authorProfileImage,
          isTodoOwner: authorId === record.todoOwnerId,
        }
      : null,
    content: isHidden ? null : record.content,
    isDeleted: isHidden,
    isAuthorBlocked,
    isEdited: record.editedAt !== null,
    likeCount: isHidden ? 0 : record.likeCount,
    replyCount: record.replyCount,
    replyTo:
      record.parentId === null
        ? null
        : {
            commentId: record.parentId,
            authorName: isParentAuthorBlocked ? null : record.parentAuthorName,
          },
    viewer,
    createdAt: record.createdAt,
    editedAt: record.editedAt,
  };
}

/** 응답에 실릴 수 있는 작성자 ID. 차단 관계를 한 번에 조회하는 후보로 쓴다. */
export function collectCommentAuthorIds(records: readonly TodoCommentRecord[]): string[] {
  return records.flatMap((record) =>
    record.parentAuthorId == null ? [record.authorId] : [record.authorId, record.parentAuthorId],
  );
}

export function collectCommentIds(records: readonly TodoCommentRecord[]): string[] {
  return records.map((record) => record.id);
}

export function toTodoCommentAuthorResponse(
  record: TodoCommentParticipantAuthorRecord,
): TodoCommentAuthor {
  return {
    id: record.id,
    name: record.name,
    profileImage: record.profileImage,
    isTodoOwner: record.isTodoOwner,
  };
}
