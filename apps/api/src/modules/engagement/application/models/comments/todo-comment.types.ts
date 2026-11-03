import type {
  Todo,
  TodoCommentCursorPagination,
  TodoCommentSort,
  TodoDetailsResponse,
} from "@aido/api";

import type { CommentPlacement } from "../../../domain/value-objects/comments/comment-placement.vo.js";

/** 댓글 응답을 만드는 데 필요한 저장소 독립 읽기 모델. */
export interface TodoCommentRecord {
  id: string;
  todoId: number;
  /** 답글이 속한 묶음의 머리 댓글. 댓글이면 null */
  threadCommentId: string | null;
  /** 답글이 답한 글. 댓글이거나 대상이 사라졌으면 null */
  replyToCommentId: string | null;
  /** 답글 대상 작성자. 차단 관계면 @멘션 이름을 가린다 */
  replyToAuthorId: string | null;
  replyToAuthorName: string | null;
  authorId: string;
  authorName: string | null;
  /** 작성자 Aido ID. 같은 이름의 작성자를 구분하는 데 쓴다 */
  authorUserTag: string | null;
  authorProfileImage: string | null;
  todoOwnerId: string;
  content: string | null;
  likeCount: number;
  replyCount: number;
  deletedAt: string | null;
  editedAt: string | null;
  createdAt: string;
}

export interface TodoDetailsRecord {
  todo: Todo;
  owner: TodoDetailsResponse["owner"];
  viewCount: number;
  commentCount: number;
  isOwner: boolean;
}

/**
 * 묶음 머리를 정렬하던 순간의 위치.
 *
 * 인기 점수는 페이지를 넘기는 사이 바뀔 수 있으므로 현재 DB 값이 아니라 cursor에 담은 값을
 * 경계로 쓴다. 불변 createdAt과 묶음 안 순서는 anchor 행에서 읽고 wire에는 싣지 않는다.
 */
export interface TodoCommentRootPosition {
  rootLikeCount: number;
  rootReplyCount: number;
}

export type TodoConversationScope = "TODO" | "THREAD";

/** 대화 reader만 만드는 행. 일반 댓글 projection에는 정렬 내부 값을 섞지 않는다. */
export interface TodoConversationRecord extends TodoCommentRecord {
  conversationPosition: TodoCommentRootPosition;
}

/** 대화 커서는 화면에 노출하지 않는 정렬의 불변 행 위치를 식별한다. */
export type TodoConversationCursor = {
  v: 1;
  kind: "conversation";
  sort: TodoCommentSort;
  todoId: number;
  commentId: string;
  threadId: string;
  scope: TodoConversationScope;
  position: TodoCommentRootPosition;
};

export const TODO_COMMENT_PAGE_DIRECTION = {
  BEFORE: "BEFORE",
  AFTER: "AFTER",
} as const;

export type TodoCommentPageDirection =
  (typeof TODO_COMMENT_PAGE_DIRECTION)[keyof typeof TODO_COMMENT_PAGE_DIRECTION];

/** 1.14.0 이하 앱이 가진 cursor도 그대로 읽도록 wire kind는 overview로 둔다. */
export type TodoCommentThreadCursor = {
  v: 1;
  kind: "overview";
  sort: TodoCommentSort;
  todoId: number;
  rootId: string;
  position: TodoCommentRootPosition;
  direction?: TodoCommentPageDirection;
};

export type TodoCommentRepliesCursor = {
  v: 1;
  kind: "replies";
  todoId: number;
  threadCommentId: string;
  replyId: string;
  direction: TodoCommentPageDirection;
};

export type ConversationPageMode = "INITIAL" | "BEFORE" | "AFTER" | "FOCUS";

export interface ListTodoConversationParams {
  todoId: number;
  sort: TodoCommentSort;
  size: number;
  mode: ConversationPageMode;
  scope: TodoConversationScope;
  anchorCommentId?: string;
  anchorThreadId?: string;
  anchorPosition?: TodoCommentRootPosition;
}

/** 저장소가 앞뒤 경계 한 행까지 읽은 뒤 돌려주는 대화 창. */
export interface TodoConversationWindow {
  items: TodoConversationRecord[];
  anchorIndex: number | null;
  previousRecord: TodoConversationRecord | null;
  nextRecord: TodoConversationRecord | null;
  hasPrevious: boolean;
  hasNext: boolean;
}

export type TodoCommentPageMode = "INITIAL" | TodoCommentPageDirection;

export interface ListTodoCommentThreadsParams {
  todoId: number;
  sort: TodoCommentSort;
  size: number;
  mode: TodoCommentPageMode | "ANCHOR";
  anchorCommentId?: string;
  anchorPosition?: TodoCommentRootPosition;
}

/** 묶음 머리 댓글만 가지는 keyset 위치. 일반 댓글 projection에는 노출하지 않는다. */
export interface TodoCommentThreadRecord extends TodoCommentRecord {
  threadPosition: TodoCommentRootPosition;
}

export interface TodoCommentParticipantAuthorRecord {
  id: string;
  name: string | null;
  userTag: string | null;
  profileImage: string | null;
  isTodoOwner: boolean;
}

export interface TodoCommentThreadItemRecord {
  comment: TodoCommentThreadRecord;
  previewReply: TodoCommentRecord | null;
  totalCount: number;
  participantAuthors: TodoCommentParticipantAuthorRecord[];
}

export interface TodoCommentWindow<T> {
  items: T[];
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface ListTodoCommentRepliesParams {
  todoId: number;
  threadCommentId: string;
  size: number;
  mode: TodoCommentPageMode | "AROUND";
  anchorReplyId?: string;
}

/** 버전과 무관한 읽기 결과. v1·v2 presenter가 각자 응답 모양으로 바꾼다. */
export interface TodoCommentViewerContext {
  viewerId: string;
  likedCommentIds: ReadonlySet<string>;
  blockedAuthorIds: ReadonlySet<string>;
}

export interface TodoCommentThreadAnchorRecord {
  threadCommentId: string;
  replyId: string | null;
}

export interface TodoCommentThreadsResult {
  items: TodoCommentThreadItemRecord[];
  viewer: TodoCommentViewerContext;
  pagination: TodoCommentCursorPagination;
  anchor: TodoCommentThreadAnchorRecord | null;
}

export interface TodoCommentRepliesResult {
  items: TodoCommentRecord[];
  viewer: TodoCommentViewerContext;
  pagination: TodoCommentCursorPagination;
}

export interface CreateTodoCommentChainInput {
  todoId: number;
  authorId: string;
  placement: CommentPlacement;
  items: { clientRequestId: string; content: string }[];
}

/** 멱등 replay 여부를 확인할 때 쓰는 정규화된 원본 명령. */
export interface TodoCommentChainCommand {
  todoId: number;
  authorId: string;
  parentId: string | null;
  items: { clientRequestId: string; content: string }[];
}

export interface TodoCommentChainCreationResult {
  commentIds: string[];
  /** 이번 요청으로 새로 생긴 글 수. 재시도로 전부 이미 있으면 0이다. */
  createdCount: number;
}

export interface TodoCommentLikeTransition {
  commentId: string;
  commentAuthorId: string | null;
  changed: boolean;
  isLiked: boolean;
  likeCount: number;
  wasEverNotified: boolean;
}
