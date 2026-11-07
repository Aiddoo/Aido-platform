import { uniqBy } from 'es-toolkit';
import { match } from 'ts-pattern';

import type {
  TodoComment,
  TodoCommentLikeResult,
  TodoCommentReplyPage,
  TodoCommentThread,
  TodoCommentThreadPage,
} from '../schemas/todo-comment.schema';

type TodoCommentDisplayState = 'active' | 'deleted' | 'blockedAuthor';

function getDisplayState(
  comment: Pick<TodoComment, 'isDeleted' | 'isAuthorBlocked'>,
): TodoCommentDisplayState {
  return match(comment)
    .returnType<TodoCommentDisplayState>()
    .with({ isAuthorBlocked: true }, () => 'blockedAuthor')
    .with({ isDeleted: true }, () => 'deleted')
    .otherwise(() => 'active');
}

function isActiveComment(comment: Pick<TodoComment, 'isDeleted' | 'isAuthorBlocked'>) {
  return getDisplayState(comment) === 'active';
}

function isReply(comment: Pick<TodoComment, 'threadCommentId'>) {
  return comment.threadCommentId != null;
}

function canLikeComment(comment: Pick<TodoComment, 'isDeleted' | 'isAuthorBlocked'>) {
  return isActiveComment(comment);
}

function canReplyToComment(comment: TodoComment) {
  return isActiveComment(comment) && comment.viewer.canReply;
}

function canEditComment(comment: TodoComment) {
  return isActiveComment(comment) && comment.viewer.canEdit;
}

function canDeleteComment(comment: TodoComment) {
  return isActiveComment(comment) && comment.viewer.canDelete;
}

/** 내 할 일에 달린 남의 글. 수정은 작성자만 할 수 있어 지울 수만 있으면 남의 글이다 */
function canDeleteOnlyAsTodoOwner(comment: TodoComment) {
  return canDeleteComment(comment) && !comment.viewer.canEdit;
}

function canCopyComment(comment: Pick<TodoComment, 'isDeleted' | 'isAuthorBlocked' | 'content'>) {
  return isActiveComment(comment) && comment.content != null;
}

function canReportComment(comment: TodoComment) {
  return isActiveComment(comment) && comment.viewer.canReport;
}

function canBlockCommentAuthor(comment: TodoComment) {
  return isActiveComment(comment) && comment.author != null && comment.viewer.canBlock;
}

function hasCommentActions(comment: TodoComment) {
  return (
    canEditComment(comment) ||
    canCopyComment(comment) ||
    canDeleteComment(comment) ||
    canReportComment(comment) ||
    canBlockCommentAuthor(comment)
  );
}

/** 답글이 남은 댓글은 지워도 "삭제된 댓글이에요"로 남는다 */
function leavesTombstoneOnDelete(comment: TodoComment) {
  return !isReply(comment) && comment.replyCount > 0;
}

function getHiddenReplyCount(thread: Pick<TodoCommentThread, 'replySummary'>, loadedCount: number) {
  return Math.max(0, thread.replySummary.totalCount - loadedCount);
}

function hasRepliesToShow(thread: Pick<TodoCommentThread, 'replySummary'>) {
  return thread.replySummary.totalCount > 0;
}

function flattenThreads(pages: readonly TodoCommentThreadPage[]) {
  return uniqBy(
    pages.flatMap((page) => page.items),
    (thread) => thread.comment.id,
  );
}

/** 방금 쓴 답글은 마지막 페이지 끝에 먼저 붙고, 남은 페이지를 받으면 그 뒤 위치(작성 순)로 옮겨 간다 */
function flattenReplies(pages: readonly TodoCommentReplyPage[]) {
  return uniqBy(pages.flatMap((page) => page.items).toReversed(), (reply) => reply.id).toReversed();
}

function withLiked(comment: TodoComment, isLiked: boolean): TodoComment {
  if (comment.viewer.isLiked === isLiked) {
    return comment;
  }

  return {
    ...comment,
    likeCount: Math.max(0, comment.likeCount + (isLiked ? 1 : -1)),
    viewer: { ...comment.viewer, isLiked },
  };
}

function withLikeResult(comment: TodoComment, result: TodoCommentLikeResult): TodoComment {
  return {
    ...comment,
    likeCount: result.likeCount,
    viewer: { ...comment.viewer, isLiked: result.isLiked },
  };
}

function withContentEdited(comment: TodoComment, content: string): TodoComment {
  return { ...comment, content, isEdited: true };
}

function withReplyCount(thread: TodoCommentThread, totalCount: number): TodoCommentThread {
  const visibleCount = Math.max(0, totalCount);
  const previewCount = thread.previewReply == null ? 0 : 1;

  return {
    ...thread,
    comment: { ...thread.comment, replyCount: visibleCount },
    replySummary: {
      ...thread.replySummary,
      totalCount: visibleCount,
      hiddenCount: Math.max(0, visibleCount - previewCount),
    },
  };
}

/** 새 답글은 묶음 수만 늘리고, 대표 답글이 없던 묶음은 그 답글을 대표로 보인다 */
function withReplyAdded(
  thread: TodoCommentThread,
  replies: readonly TodoComment[],
): TodoCommentThread {
  const [firstReply] = replies;
  const withPreview =
    thread.previewReply == null && firstReply != null
      ? { ...thread, previewReply: firstReply }
      : thread;

  return withReplyCount(withPreview, thread.replySummary.totalCount + replies.length);
}

function toTombstone(comment: TodoComment): TodoComment {
  return {
    ...comment,
    author: null,
    content: null,
    isDeleted: true,
    likeCount: 0,
    viewer: {
      ...comment.viewer,
      isLiked: false,
      canEdit: false,
      canDelete: false,
      canReply: false,
      canReport: false,
      canBlock: false,
    },
  };
}

/**
 * 지운 글을 묶음에서 뺀다. 답글이 남은 댓글은 tombstone이 되고, 답글 없는 tombstone 댓글은 묶음째 사라진다.
 * 묶음째 사라지면 null을 돌려준다.
 */
function withCommentRemoved(
  thread: TodoCommentThread,
  removed: TodoComment,
): TodoCommentThread | null {
  if (thread.comment.id === removed.id) {
    return hasRepliesToShow(thread) ? { ...thread, comment: toTombstone(thread.comment) } : null;
  }

  if (removed.threadCommentId !== thread.comment.id) {
    return thread;
  }

  const withoutPreview =
    thread.previewReply?.id === removed.id ? { ...thread, previewReply: null } : thread;
  const next = withReplyCount(withoutPreview, thread.replySummary.totalCount - 1);

  return next.comment.isDeleted && next.replySummary.totalCount === 0 ? null : next;
}

function withRepliesRemoved(replies: readonly TodoComment[], commentId: string) {
  return replies.filter((reply) => reply.id !== commentId);
}

function findCommentInThread(thread: TodoCommentThread, commentId: string) {
  return [thread.comment, thread.previewReply].find((comment) => comment?.id === commentId) ?? null;
}

export const TodoCommentPolicy = {
  getDisplayState,
  isReply,
  canLikeComment,
  canReplyToComment,
  canEditComment,
  canDeleteComment,
  canDeleteOnlyAsTodoOwner,
  canCopyComment,
  canReportComment,
  canBlockCommentAuthor,
  hasCommentActions,
  leavesTombstoneOnDelete,
  getHiddenReplyCount,
  hasRepliesToShow,
  flattenThreads,
  flattenReplies,
  withLiked,
  withLikeResult,
  withContentEdited,
  withReplyAdded,
  withCommentRemoved,
  withRepliesRemoved,
  findCommentInThread,
} as const;
