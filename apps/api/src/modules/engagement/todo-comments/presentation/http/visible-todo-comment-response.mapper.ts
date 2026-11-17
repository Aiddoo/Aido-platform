import type { TodoCommentCursorPagination } from "@aido/api/contracts/todo-comment/v1";
import type { TodoComment, TodoCommentAuthor } from "@aido/api/contracts/todo-comment/v2";

import { resolveProfileImage } from "#api/platform/http/profile/profile-image.resolver";
import { toIsoString } from "#api/shared/domain/time/instant";

import type {
  TodoCommentCursorPageReadModel,
  TodoCommentParticipantAuthorReadModel,
  TodoCommentReadModel,
  TodoCommentThreadItemReadModel,
  TodoCommentViewerReadModel,
} from "../../application/read-models/todo-comment.read-model.js";
import { getTodoCommentViewerPermissions } from "../../domain/todo-comment-permission.domain-service.js";

/**
 * v1·v2가 함께 쓰는 댓글 표현. 보는 사람과 차단 관계인 작성자의 글은 위치만 남기고 지운 글처럼 가린다.
 * isAuthorBlocked를 모르는 구 앱도 지운 댓글로 그려 차단한 사람의 이름·내용이 보이지 않는다.
 */
export function toVisibleTodoCommentResponse(
  comment: TodoCommentReadModel,
  viewer: TodoCommentViewerReadModel,
  appVersion?: string,
): TodoComment {
  const isAuthorBlocked = viewer.blockedAuthorIds.has(comment.authorId);
  const isHidden = comment.deletedAt != null || isAuthorBlocked;
  const isReplyTargetAuthorBlocked =
    comment.replyToAuthorId != null && viewer.blockedAuthorIds.has(comment.replyToAuthorId);

  return {
    id: comment.id,
    todoId: comment.todoId,
    threadCommentId: comment.threadCommentId,
    replyTo:
      comment.replyToCommentId == null
        ? null
        : {
            commentId: comment.replyToCommentId,
            authorName: isReplyTargetAuthorBlocked ? null : comment.replyToAuthorName,
          },
    author: isHidden
      ? null
      : {
          id: comment.authorId,
          name: comment.authorName,
          userTag: comment.authorUserTag,
          profileImage: resolveProfileImage(comment.authorProfileImage, appVersion),
          isTodoOwner: comment.authorId === comment.todoOwnerId,
        },
    content: isHidden ? null : comment.content,
    likeCount: isHidden ? 0 : comment.likeCount,
    replyCount: comment.replyCount,
    isDeleted: isHidden,
    isAuthorBlocked,
    isEdited: comment.editedAt != null,
    viewer: getTodoCommentViewerPermissions({
      isDeleted: isHidden,
      isLiked: viewer.likedCommentIds.has(comment.id),
      authorId: comment.authorId,
      viewerId: viewer.viewerId,
      todoOwnerId: comment.todoOwnerId,
    }),
    createdAt: toIsoString(comment.createdAt),
    editedAt: comment.editedAt == null ? null : toIsoString(comment.editedAt),
  };
}

/** 차단 관계인 작성자의 답글은 가린 묘비로 보이므로 대표 답글로 내보내지 않는다 */
export function findVisiblePreviewReply(
  item: TodoCommentThreadItemReadModel,
  viewer: TodoCommentViewerReadModel,
): TodoCommentReadModel | null {
  const preview = item.previewReply;
  return preview == null || viewer.blockedAuthorIds.has(preview.authorId) ? null : preview;
}

function toParticipantAuthorResponse(
  author: TodoCommentParticipantAuthorReadModel,
  appVersion?: string,
): TodoCommentAuthor {
  return {
    id: author.id,
    name: author.name,
    userTag: author.userTag,
    profileImage: resolveProfileImage(author.profileImage, appVersion),
    isTodoOwner: author.isTodoOwner,
  };
}

export function toVisibleParticipantAuthorResponses(
  item: TodoCommentThreadItemReadModel,
  viewer: TodoCommentViewerReadModel,
  appVersion?: string,
): TodoCommentAuthor[] {
  return item.participantAuthors
    .filter((author) => !viewer.blockedAuthorIds.has(author.id))
    .map((author) => toParticipantAuthorResponse(author, appVersion));
}

export function toTodoCommentPaginationResponse(
  page: TodoCommentCursorPageReadModel,
): TodoCommentCursorPagination {
  return {
    previousCursor: page.previousCursor,
    nextCursor: page.nextCursor,
    hasPrevious: page.hasPrevious,
    hasNext: page.hasNext,
    size: page.size,
  };
}
