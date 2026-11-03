import {
  todoCommentCursorPaginationSchema,
  todoCommentThreadAnchorSchema,
  todoCommentThreadSchema as todoCommentThreadContractSchema,
  type todoCommentV2AuthorSchema,
  todoCommentV2Schema,
} from '@aido/api';
import { uniqBy } from 'es-toolkit';
import { match } from 'ts-pattern';
import { z } from 'zod';

export type TodoCommentAuthor = z.infer<typeof todoCommentV2AuthorSchema>;

export const todoCommentSchema = todoCommentV2Schema.extend({
  createdAt: z.date(),
  editedAt: z.date().nullable(),
});
export type TodoComment = z.infer<typeof todoCommentSchema>;

export const todoCommentThreadSchema = todoCommentThreadContractSchema.extend({
  comment: todoCommentSchema,
  previewReply: todoCommentSchema.nullable(),
});
export type TodoCommentThread = z.infer<typeof todoCommentThreadSchema>;

export type TodoCommentThreadAnchor = z.infer<typeof todoCommentThreadAnchorSchema>;

export const todoCommentThreadPageSchema = z.object({
  items: z.array(todoCommentThreadSchema),
  pagination: todoCommentCursorPaginationSchema,
  anchor: todoCommentThreadAnchorSchema.nullable(),
});
export type TodoCommentThreadPage = z.infer<typeof todoCommentThreadPageSchema>;

export const todoCommentReplyPageSchema = z.object({
  items: z.array(todoCommentSchema),
  pagination: todoCommentCursorPaginationSchema,
});
export type TodoCommentReplyPage = z.infer<typeof todoCommentReplyPageSchema>;

export const todoCommentChainSchema = z.object({ comments: z.array(todoCommentSchema) });
export type TodoCommentChain = z.infer<typeof todoCommentChainSchema>;

export const todoCommentLikeResultSchema = z.object({
  commentId: z.string(),
  isLiked: z.boolean(),
  likeCount: z.number(),
});
export type TodoCommentLikeResult = z.infer<typeof todoCommentLikeResultSchema>;

export type TodoCommentDisplayState = 'active' | 'deleted' | 'blockedAuthor';

export function displayStateOf(comment: TodoComment): TodoCommentDisplayState {
  return match(comment)
    .returnType<TodoCommentDisplayState>()
    .with({ isAuthorBlocked: true }, () => 'blockedAuthor')
    .with({ isDeleted: true }, () => 'deleted')
    .otherwise(() => 'active');
}

export function isActiveComment(comment: TodoComment) {
  return displayStateOf(comment) === 'active';
}

export function isReply(comment: TodoComment) {
  return comment.threadCommentId != null;
}

export function isByTodoOwner(comment: TodoComment) {
  return comment.author?.isTodoOwner === true;
}

export function userTagLabelOf(comment: TodoComment) {
  return comment.author?.userTag == null ? null : `#${comment.author.userTag}`;
}

/** 대상이 탈퇴·차단으로 이름을 잃으면 서버가 null을 준다. 그때는 @멘션 없이 본문만 보인다 */
export function mentionNameOf(comment: TodoComment) {
  return comment.replyTo?.authorName ?? null;
}

export function canLikeComment(comment: TodoComment) {
  return isActiveComment(comment);
}

export function canReplyToComment(comment: TodoComment) {
  return isActiveComment(comment) && comment.viewer.canReply;
}

export function isEditableComment(comment: TodoComment) {
  return isActiveComment(comment) && comment.viewer.canEdit;
}

export function canDeleteComment(comment: TodoComment) {
  return isActiveComment(comment) && comment.viewer.canDelete;
}

/** 내 할 일에 달린 남의 글. 수정은 작성자만 할 수 있어 지울 수만 있으면 남의 글이다 */
export function isDeletingOthersComment(comment: TodoComment) {
  return canDeleteComment(comment) && !comment.viewer.canEdit;
}

export function canCopyComment(comment: TodoComment) {
  return isActiveComment(comment) && comment.content != null;
}

export function canReportComment(comment: TodoComment) {
  return isActiveComment(comment) && comment.viewer.canReport;
}

export function canBlockCommentAuthor(comment: TodoComment) {
  return isActiveComment(comment) && comment.author != null && comment.viewer.canBlock;
}

export function hasCommentActions(comment: TodoComment) {
  return (
    isEditableComment(comment) ||
    canCopyComment(comment) ||
    canDeleteComment(comment) ||
    canReportComment(comment) ||
    canBlockCommentAuthor(comment)
  );
}

/** 답글이 남은 댓글은 지워도 "삭제된 댓글이에요"로 남는다 */
export function leavesTombstoneOnDelete(comment: TodoComment) {
  return !isReply(comment) && comment.replyCount > 0;
}

export function hiddenReplyCountOf(thread: TodoCommentThread, loadedCount: number) {
  return Math.max(0, thread.replySummary.totalCount - loadedCount);
}

export function hasRepliesToShow(thread: TodoCommentThread) {
  return thread.replySummary.totalCount > 0;
}

export function flattenThreads(pages: readonly TodoCommentThreadPage[]) {
  return uniqBy(
    pages.flatMap((page) => page.items),
    (thread) => thread.comment.id,
  );
}

/** 방금 쓴 답글은 마지막 페이지 끝에 먼저 붙고, 남은 페이지를 받으면 그 뒤 위치(작성 순)로 옮겨 간다 */
export function flattenReplies(pages: readonly TodoCommentReplyPage[]) {
  return uniqBy(pages.flatMap((page) => page.items).toReversed(), (reply) => reply.id).toReversed();
}

export function anchorOf(pages: readonly TodoCommentThreadPage[]) {
  return pages[0]?.anchor ?? null;
}

export function withLikeToggled(comment: TodoComment, isLiked: boolean): TodoComment {
  if (comment.viewer.isLiked === isLiked) {
    return comment;
  }

  return {
    ...comment,
    likeCount: Math.max(0, comment.likeCount + (isLiked ? 1 : -1)),
    viewer: { ...comment.viewer, isLiked },
  };
}

export function withLikeResult(comment: TodoComment, result: TodoCommentLikeResult): TodoComment {
  return {
    ...comment,
    likeCount: result.likeCount,
    viewer: { ...comment.viewer, isLiked: result.isLiked },
  };
}

export function withContentEdited(comment: TodoComment, content: string): TodoComment {
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
export function withReplyAdded(
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
export function withCommentRemoved(
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

export function withRepliesRemoved(replies: readonly TodoComment[], commentId: string) {
  return replies.filter((reply) => reply.id !== commentId);
}

export function findCommentInThread(thread: TodoCommentThread, commentId: string) {
  return [thread.comment, thread.previewReply].find((comment) => comment?.id === commentId) ?? null;
}

export const TodoCommentPolicy = {
  displayState: displayStateOf,
  isReply,
  isByTodoOwner,
  userTagLabel: userTagLabelOf,
  mentionName: mentionNameOf,
  canLike: canLikeComment,
  canReply: canReplyToComment,
  isEditable: isEditableComment,
  canDelete: canDeleteComment,
  isDeletingOthers: isDeletingOthersComment,
  canCopy: canCopyComment,
  canReport: canReportComment,
  canBlockAuthor: canBlockCommentAuthor,
  hasActions: hasCommentActions,
  leavesTombstoneOnDelete,
  hiddenReplyCount: hiddenReplyCountOf,
  hasRepliesToShow,
  flattenThreads,
  flattenReplies,
  anchorOf,
  withLikeToggled,
  withLikeResult,
  withContentEdited,
  withReplyAdded,
  withCommentRemoved,
  withRepliesRemoved,
  findCommentInThread,
} as const;
