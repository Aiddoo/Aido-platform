import { TODO_COMMENT_LIMITS, TODO_COMMENT_SORT } from '@aido/validators';
import { z } from 'zod';

// ─── Schema & Type ───

export const todoCommentSortSchema = z.enum(TODO_COMMENT_SORT);
export type TodoCommentSort = z.infer<typeof todoCommentSortSchema>;

export const todoCommentAuthorSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
  /** 할 일 작성자 본인인지 — "작성자" 뱃지의 근거는 서버가 정한다. */
  isTodoOwner: z.boolean(),
});
export type TodoCommentAuthor = z.infer<typeof todoCommentAuthorSchema>;

/** 이 댓글에 대해 보는 사람이 할 수 있는 일. 판단의 주인은 서버다. */
export const todoCommentViewerSchema = z.object({
  isLiked: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
  canReply: z.boolean(),
});
export type TodoCommentViewer = z.infer<typeof todoCommentViewerSchema>;

export const todoCommentReplyTargetSchema = z.object({
  commentId: z.string(),
  authorName: z.string().nullable(),
});
export type TodoCommentReplyTarget = z.infer<typeof todoCommentReplyTargetSchema>;

const todoCommentBaseSchema = z.object({
  id: z.string(),
  todoId: z.number(),
  /** 직계 부모. null이면 할 일에 바로 달린 최상위 댓글이다. */
  parentId: z.string().nullable(),
  /** 이 댓글이 속한 대화의 뿌리. 최상위 댓글이면 없다. */
  rootId: z.string().nullable(),
  /** 뿌리에서 이 댓글까지의 깊이. 최상위는 0이고 상한은 없다. */
  depth: z.number(),
  /** 삭제된 댓글은 작성자와 본문이 지워진다. */
  author: todoCommentAuthorSchema.nullable(),
  content: z.string().nullable(),
  isDeleted: z.boolean(),
  isEdited: z.boolean(),
  likeCount: z.number(),
  /** 직계 답글 수. 자손 전체가 아니다. */
  replyCount: z.number(),
  hasReplies: z.boolean(),
  /** 지금 화면에 실리지 않은 답글이 더 있는지 — 판단의 주인은 서버다. */
  hasMoreReplies: z.boolean(),
  /** 누구에게 단 답글인지 — @멘션의 근거. */
  replyTo: todoCommentReplyTargetSchema.nullable(),
  viewer: todoCommentViewerSchema,
  createdAt: z.date(),
  editedAt: z.date().nullable(),
});

/** 목록에 함께 실려 오는 답글 한 겹. 자기 답글은 개수로만 알린다. */
export const todoCommentPreviewSchema = todoCommentBaseSchema;
export type TodoCommentPreview = z.infer<typeof todoCommentPreviewSchema>;

/** 목록의 한 줄. 어느 깊이에 있든 같은 모양이다. */
export const todoCommentSchema = todoCommentBaseSchema.extend({
  replyPreview: z.array(todoCommentPreviewSchema),
});
export type TodoComment = z.infer<typeof todoCommentSchema>;

/**
 * 화면에는 있지만 서버가 아직 확인하지 않은 댓글 — 댓글 수명의 한 단계다.
 * 이 상태에서는 좋아요·답글·수정 어느 것도 열리지 않는다.
 */
export type PendingTodoComment<T extends TodoCommentPreview> = T & { isPending: true };

export const todoCommentPageSchema = z.object({
  comments: z.array(todoCommentSchema),
  nextCursor: z.string().nullable(),
  hasNext: z.boolean(),
});
export type TodoCommentPage = z.infer<typeof todoCommentPageSchema>;

/**
 * 스레드 화면의 머리말. 조상은 뿌리 → 부모 순서로 온다.
 * 정렬과 무관한 값만 담아, 정렬을 바꿔도 다시 받지 않는다 (답글 목록은 별도 쿼리다).
 */
export const todoCommentThreadSchema = z.object({
  ancestors: z.array(todoCommentPreviewSchema),
  comment: todoCommentSchema,
});
export type TodoCommentThread = z.infer<typeof todoCommentThreadSchema>;

/** 한 번에 이어 쓴 글 묶음. 앞 글의 답글로 차례로 이어진다. */
export const todoCommentChainSchema = z.object({
  comments: z.array(todoCommentSchema),
});
export type TodoCommentChain = z.infer<typeof todoCommentChainSchema>;

export const todoCommentLikeResultSchema = z.object({
  commentId: z.string(),
  isLiked: z.boolean(),
  likeCount: z.number(),
});
export type TodoCommentLikeResult = z.infer<typeof todoCommentLikeResultSchema>;

/** 서버로 나가기 전의 글 묶음. 입력 검증은 commentFormSchema가 맡는다. */
export interface TodoCommentDraft {
  contents: string[];
}

// ─── 순수 함수 (독립 테스트 가능) ───

/** 답글에 붙는 @멘션 이름. 대상이 없거나 탈퇴했으면 없다. */
export const mentionedAuthorName = (comment: TodoCommentPreview) =>
  comment.replyTo?.authorName ?? null;

const isPendingComment = (comment: TodoCommentPreview) => 'isPending' in comment;

const isAlive = (comment: TodoCommentPreview) => !comment.isDeleted;

const isConfirmed = (comment: TodoCommentPreview) => !isPendingComment(comment);

/** 살아 있고 서버가 확인한 댓글에만 무엇이든 할 수 있다 — 모든 규칙의 공통 앞자락. */
const isActionable = (comment: TodoCommentPreview) => isAlive(comment) && isConfirmed(comment);

/** 같은 사람이 이어 쓴 댓글인지 — 두 행을 한 덩어리로 읽게 하는 기준. */
const isSameAuthor = (one: TodoComment | undefined, other: TodoComment | undefined) =>
  one?.author != null && other?.author != null && one.author.id === other.author.id;

/** 답글이 달렸으면 그 아래 흐름은 답글 가지가 이어받는다. */
const handsOverToReplies = (comment: TodoComment | undefined) => comment?.hasReplies === true;

// ─── Policy ───

/**
 * 무엇을 할 수 있는지는 전부 여기서 판단한다.
 * 각 규칙은 공통 앞자락에 서버가 준 허가 하나를 && 로 얹은 모양이고,
 * 규칙이 늘어나면 && 한 줄만 추가된다.
 */
export const TodoCommentPolicy = {
  /** 이 댓글에 무엇이든 걸 수 있는지 — 액션 줄을 놓을지 정하는 자리도 이걸 묻는다. */
  canAct: (comment: TodoCommentPreview) => isActionable(comment),
  canLike: (comment: TodoCommentPreview) => isActionable(comment),
  canReply: (comment: TodoCommentPreview) => isActionable(comment) && comment.viewer.canReply,
  canEdit: (comment: TodoCommentPreview) => isActionable(comment) && comment.viewer.canEdit,
  canDelete: (comment: TodoCommentPreview) => isActionable(comment) && comment.viewer.canDelete,
  /** ⋯ 메뉴를 열 수 있는지 — 그 안에 놓일 것이 하나라도 있으면 연다. */
  canManage: (comment: TodoCommentPreview) =>
    TodoCommentPolicy.canEdit(comment) || TodoCommentPolicy.canDelete(comment),
} as const;

/**
 * 목록에서 두 댓글이 한 흐름으로 이어지는지 — 스레드 선을 그릴지 정하는 유일한 판정.
 *
 * 이웃 관계만 보므로 정렬(최신순↔인기순)이 바뀌어도 옛 판정이 남지 않는다.
 * 규칙이 늘어나면 && 한 줄만 추가된다.
 */
export const TodoCommentDraftPolicy = {
  /**
   * 칸을 하나 더 열 수 있는지. 수정은 언제나 한 글이라 이어 쓰지 않는다.
   */
  canAddMore: (draft: { contents: readonly string[]; isEditing: boolean }) =>
    !draft.isEditing && draft.contents.length < TODO_COMMENT_LIMITS.CHAIN_MAX_SIZE,

  /**
   * 게시할 수 있는지 — 열려 있는 칸이 하나라도 비어 있으면 열리지 않는다.
   *
   * 빈 묶음을 따로 막는 이유: `every`는 빈 배열에 참이라, 칸이 하나도 없을 때
   * 조용히 통과해 버린다.
   */
  canPost: (contents: readonly string[]) =>
    contents.length > 0 && contents.every((content) => content.trim().length > 0),
} as const;

export const TodoCommentThreadPolicy = {
  continuesInto: (one: TodoComment | undefined, other: TodoComment | undefined) =>
    isSameAuthor(one, other) && !handsOverToReplies(one),
} as const;
