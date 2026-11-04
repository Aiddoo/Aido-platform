import { uniqBy } from 'es-toolkit';
import { match, P } from 'ts-pattern';
import { z } from 'zod';

export const todoCommentAuthorSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  userTag: z.string().nullable(),
  profileImage: z.string().nullable(),
  isTodoOwner: z.boolean(),
});
export type TodoCommentAuthor = z.infer<typeof todoCommentAuthorSchema>;

export const todoCommentSchema = z.object({
  id: z.string(),
  todoId: z.int().positive(),
  threadCommentId: z.string().nullable(),
  replyTo: z.object({ commentId: z.string(), authorName: z.string().nullable() }).nullable(),
  author: todoCommentAuthorSchema.nullable(),
  content: z.string().nullable(),
  likeCount: z.int().nonnegative(),
  replyCount: z.int().nonnegative(),
  isDeleted: z.boolean(),
  isAuthorBlocked: z.boolean(),
  isEdited: z.boolean(),
  viewer: z.object({
    isLiked: z.boolean(),
    canEdit: z.boolean(),
    canDelete: z.boolean(),
    canReply: z.boolean(),
    canReport: z.boolean(),
    canBlock: z.boolean(),
  }),
  createdAt: z.date(),
  editedAt: z.date().nullable(),
});
export type TodoComment = z.infer<typeof todoCommentSchema>;

export const todoCommentThreadSchema = z.object({
  comment: todoCommentSchema,
  previewReply: todoCommentSchema.nullable(),
  replySummary: z.object({
    totalCount: z.int().nonnegative(),
    hiddenCount: z.int().nonnegative(),
    participantAuthors: z.array(todoCommentAuthorSchema),
  }),
});
export type TodoCommentThread = z.infer<typeof todoCommentThreadSchema>;

export const todoCommentThreadAnchorSchema = z.object({
  threadCommentId: z.string(),
  replyId: z.string().nullable(),
});
export type TodoCommentThreadAnchor = z.infer<typeof todoCommentThreadAnchorSchema>;

export const todoCommentPaginationSchema = z.object({
  previousCursor: z.string().nullable(),
  nextCursor: z.string().nullable(),
  hasPrevious: z.boolean(),
  hasNext: z.boolean(),
  size: z.int().positive(),
});
export type TodoCommentPagination = z.infer<typeof todoCommentPaginationSchema>;

export const todoCommentThreadPageSchema = z.object({
  items: z.array(todoCommentThreadSchema),
  pagination: todoCommentPaginationSchema,
  anchor: todoCommentThreadAnchorSchema.nullable(),
});
export type TodoCommentThreadPage = z.infer<typeof todoCommentThreadPageSchema>;

export const todoCommentReplyPageSchema = z.object({
  items: z.array(todoCommentSchema),
  pagination: todoCommentPaginationSchema,
});
export type TodoCommentReplyPage = z.infer<typeof todoCommentReplyPageSchema>;

export const todoCommentChainSchema = z.object({ comments: z.array(todoCommentSchema) });
export type TodoCommentChain = z.infer<typeof todoCommentChainSchema>;

export const todoCommentLikeResultSchema = z.object({
  commentId: z.string(),
  isLiked: z.boolean(),
  likeCount: z.int().nonnegative(),
});
export type TodoCommentLikeResult = z.infer<typeof todoCommentLikeResultSchema>;

/** 사용자가 직접 펼쳤는지(user), 답글을 올려 앱이 펼쳤는지(auto) */
export const threadExpansionSchema = z.object({
  isExpanded: z.boolean(),
  source: z.enum(['user', 'auto']),
});
export type ThreadExpansion = z.infer<typeof threadExpansionSchema>;

export type ReplyFooter = 'viewMore' | 'hide' | 'none';

/** 접힌 묶음도 대표 답글 하나는 보이므로 그 이하로 불러온 묶음은 숨길 것이 없다 */
const COLLAPSED_VISIBLE_REPLY_COUNT = 1;

export type TodoCommentDisplayState = 'active' | 'deleted' | 'blockedAuthor';

export function getDisplayState(comment: TodoComment): TodoCommentDisplayState {
  return match(comment)
    .returnType<TodoCommentDisplayState>()
    .with({ isAuthorBlocked: true }, () => 'blockedAuthor')
    .with({ isDeleted: true }, () => 'deleted')
    .otherwise(() => 'active');
}

export function isActiveComment(comment: TodoComment) {
  return getDisplayState(comment) === 'active';
}

export function isReply(comment: TodoComment) {
  return comment.threadCommentId != null;
}

export function isByTodoOwner(comment: TodoComment) {
  return comment.author?.isTodoOwner === true;
}

export function getUserTagLabel(comment: TodoComment) {
  return comment.author?.userTag == null ? null : `#${comment.author.userTag}`;
}

/** 대상이 탈퇴·차단으로 이름을 잃으면 서버가 null을 준다. 그때는 @멘션 없이 본문만 보인다 */
export function getMentionName(comment: TodoComment) {
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

export function getHiddenReplyCount(thread: TodoCommentThread, loadedCount: number) {
  return Math.max(0, thread.replySummary.totalCount - loadedCount);
}

/** 사용자가 직접 펼친 묶음은 답글을 올려도 그 상태를 지킨다. 그래야 사용자가 연 "답글 숨기기"가 사라지지 않는다 */
export function expandThread(
  current: ThreadExpansion | undefined,
  source: ThreadExpansion['source'],
): ThreadExpansion {
  if (current?.isExpanded === true && current.source === 'user') {
    return current;
  }
  return { isExpanded: true, source };
}

/**
 * 펼친 묶음 아래 줄. 더 받을 답글이 있으면 "더 보기", 사용자가 펼쳤고 숨길 답글이 있으면 "숨기기", 그 밖에는 없다.
 * 답글을 올려 앱이 펼친 묶음은 사용자가 숨기기를 누를 이유가 없어 줄을 그리지 않는다.
 */
export function getReplyFooter(
  thread: TodoCommentThread,
  {
    loadedCount,
    hasNextPage,
    expansion,
  }: { loadedCount: number; hasNextPage: boolean; expansion: ThreadExpansion },
): ReplyFooter {
  return match({
    hasNextPage,
    hiddenCount: getHiddenReplyCount(thread, loadedCount),
    source: expansion.source,
    loadedCount,
  })
    .returnType<ReplyFooter>()
    .with({ hasNextPage: true, hiddenCount: P.number.gt(0) }, () => 'viewMore')
    .with({ source: 'auto' }, () => 'none')
    .with({ loadedCount: P.number.lte(COLLAPSED_VISIBLE_REPLY_COUNT) }, () => 'none')
    .otherwise(() => 'hide');
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

export function getAnchor(pages: readonly TodoCommentThreadPage[]) {
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
  getDisplayState,
  isReply,
  isByTodoOwner,
  getUserTagLabel,
  getMentionName,
  canLikeComment,
  canReplyToComment,
  isEditableComment,
  canDeleteComment,
  isDeletingOthersComment,
  canCopyComment,
  canReportComment,
  canBlockCommentAuthor,
  hasCommentActions,
  leavesTombstoneOnDelete,
  getHiddenReplyCount,
  expandThread,
  getReplyFooter,
  hasRepliesToShow,
  flattenThreads,
  flattenReplies,
  getAnchor,
  withLikeToggled,
  withLikeResult,
  withContentEdited,
  withReplyAdded,
  withCommentRemoved,
  withRepliesRemoved,
  findCommentInThread,
} as const;
