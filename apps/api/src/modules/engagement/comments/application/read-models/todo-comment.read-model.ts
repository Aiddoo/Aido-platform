import type { FriendTodoReadModel } from "#api/modules/planning/todos/planning-todos.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { TodoCommentId } from "../../domain/todo-comment-id.vo.js";

/** 댓글 응답을 만드는 데 필요한 저장소 독립 조회 결과 */
export interface TodoCommentReadModel {
  readonly id: string;
  readonly todoId: number;
  /** 답글이 속한 묶음의 머리 댓글. 댓글이면 null */
  readonly threadCommentId: string | null;
  /** 답글이 답한 글. 댓글이거나 대상이 사라졌으면 null */
  readonly replyToCommentId: string | null;
  /** 답글 대상 작성자. 차단 관계면 @멘션 이름을 가린다 */
  readonly replyToAuthorId: string | null;
  readonly replyToAuthorName: string | null;
  readonly authorId: string;
  readonly authorName: string | null;
  /** 작성자 Aido ID. 같은 이름의 작성자를 구분하는 데 쓴다 */
  readonly authorUserTag: string | null;
  readonly authorProfileImage: string | null;
  readonly todoOwnerId: string;
  readonly content: string | null;
  readonly likeCount: number;
  readonly replyCount: number;
  readonly deletedAt: Temporal.Instant | null;
  readonly editedAt: Temporal.Instant | null;
  readonly createdAt: Temporal.Instant;
}

/**
 * 묶음 머리를 정렬하던 순간의 인기 점수.
 *
 * 점수는 페이지를 넘기는 사이 바뀔 수 있어 현재 DB 값이 아니라 cursor에 담은 값을 경계로 쓴다.
 * 바뀌지 않는 createdAt과 묶음 안 순서는 기준 행에서 읽어 cursor에 싣지 않는다.
 */
export interface TodoCommentRootPosition {
  readonly rootLikeCount: number;
  readonly rootReplyCount: number;
}

/** 대화 reader만 만드는 행. 일반 댓글 조회 결과에는 정렬 내부 값을 섞지 않는다 */
export interface TodoConversationReadModel extends TodoCommentReadModel {
  readonly conversationPosition: TodoCommentRootPosition;
}

/** 묶음 머리 댓글만 가지는 keyset 위치 */
export interface TodoCommentThreadReadModel extends TodoCommentReadModel {
  readonly threadPosition: TodoCommentRootPosition;
}

export interface TodoCommentParticipantAuthorReadModel {
  readonly id: string;
  readonly name: string | null;
  readonly userTag: string | null;
  readonly profileImage: string | null;
  readonly isTodoOwner: boolean;
}

export interface TodoCommentThreadItemReadModel {
  readonly comment: TodoCommentThreadReadModel;
  readonly previewReply: TodoCommentReadModel | null;
  readonly totalCount: number;
  readonly participantAuthors: readonly TodoCommentParticipantAuthorReadModel[];
}

export interface TodoCommentWindow<TItem> {
  readonly items: readonly TItem[];
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
}

/** 저장소가 앞뒤 경계 한 행까지 읽은 뒤 돌려주는 대화 창 */
export interface TodoConversationWindow extends TodoCommentWindow<TodoConversationReadModel> {
  readonly anchorIndex: number | null;
  /** 창 바로 앞 행. cursor 행이 지워져도 경계로 남는지 확인할 때 쓴다 */
  readonly previousItem: TodoConversationReadModel | null;
  /** 창 바로 뒤 행. 마지막 행의 연결선이 이어지는지 정한다 */
  readonly nextItem: TodoConversationReadModel | null;
}

/** 버전과 무관한 보는 사람 문맥. v1·v2 응답 매퍼가 가림·권한을 계산한다 */
export interface TodoCommentViewer {
  readonly viewerId: string;
  readonly likedCommentIds: ReadonlySet<string>;
  readonly blockedAuthorIds: ReadonlySet<string>;
}

export interface TodoCommentCursorPage {
  readonly previousCursor: string | null;
  readonly nextCursor: string | null;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
  readonly size: number;
}

export interface TodoCommentThreadAnchorReadModel {
  readonly threadCommentId: string;
  readonly replyId: string | null;
}

export interface TodoCommentThreadsPage {
  readonly items: readonly TodoCommentThreadItemReadModel[];
  readonly viewer: TodoCommentViewer;
  readonly pagination: TodoCommentCursorPage;
  readonly anchor: TodoCommentThreadAnchorReadModel | null;
}

export interface TodoCommentRepliesPage {
  readonly items: readonly TodoCommentReadModel[];
  readonly viewer: TodoCommentViewer;
  readonly pagination: TodoCommentCursorPage;
}

interface TodoConversationFocusReadModel {
  readonly commentId: string;
  readonly itemIndex: number;
  /** focus 답글 앞 페이지 밖의 묶음 머리. 1.14.0 이하 앱이 대화를 이어 그리는 데 쓴다 */
  readonly precedingThreadComments: readonly TodoCommentReadModel[];
}

export interface TodoConversationPage {
  readonly items: readonly TodoCommentReadModel[];
  readonly nextItem: TodoCommentReadModel | null;
  readonly focus: TodoConversationFocusReadModel | null;
  readonly viewer: TodoCommentViewer;
  readonly pagination: TodoCommentCursorPage;
}

/** 쓰거나 고친 글과 그 글을 본 작성자의 문맥 */
export interface TodoCommentsWithViewer {
  readonly comments: readonly TodoCommentReadModel[];
  readonly viewer: TodoCommentViewer;
}

export interface TodoCommentWithViewer {
  readonly comment: TodoCommentReadModel;
  readonly viewer: TodoCommentViewer;
}

export interface TodoCommentLikeState {
  readonly commentId: string;
  readonly isLiked: boolean;
  readonly likeCount: number;
}

interface TodoDetailsOwnerReadModel {
  readonly id: string;
  readonly name: string | null;
  readonly profileImage: string | null;
}

export interface TodoDetailsReadModel {
  readonly todo: FriendTodoReadModel;
  readonly owner: TodoDetailsOwnerReadModel;
  readonly viewCount: number;
  readonly commentCount: number;
  readonly isOwner: boolean;
}

export function listCommentIds(comments: readonly TodoCommentReadModel[]): TodoCommentId[] {
  return comments.map((comment) => TodoCommentId.reconstitute(comment.id));
}

/** 응답에 실릴 수 있는 작성자 ID. 차단 관계를 한 번에 조회하는 후보로 쓴다 */
export function listCommentAuthorIds(comments: readonly TodoCommentReadModel[]): UserId[] {
  return comments.flatMap((comment) =>
    (comment.replyToAuthorId == null
      ? [comment.authorId]
      : [comment.authorId, comment.replyToAuthorId]
    ).map((authorId) => UserId.reconstitute(authorId)),
  );
}
