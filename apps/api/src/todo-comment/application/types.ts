import type { Todo, TodoCommentSort, TodoDetailsResponse } from "@aido/validators";

import type { ThreadPlacement } from "../domain/value-objects/thread-placement.vo";

/** 댓글 응답을 만드는 데 필요한 저장소 독립 읽기 모델. */
export interface TodoCommentRecord {
	id: string;
	todoId: number;
	parentId: string | null;
	rootId: string | null;
	/** 뿌리 → 부모 순서의 조상 id. focus 조상 조회에만 쓰고 wire에는 싣지 않는다. */
	path: string[];
	depth: number;
	parentAuthorName: string | null;
	authorId: string;
	authorName: string | null;
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
 * 대화 행을 정렬하던 순간의 불변 위치.
 *
 * 인기 점수는 페이지를 넘기는 사이 바뀔 수 있으므로 현재 DB 값이 아니라 cursor에 담은 값을
 * 경계로 쓴다. 불변 createdAt과 DFS 위치는 anchor 행에서 읽고 wire에는 싣지 않는다.
 */
export interface TodoCommentRootPosition {
	rootLikeCount: number;
	rootReplyCount: number;
}

export type TodoConversationPosition = TodoCommentRootPosition;

export type TodoConversationScope = "TODO" | "THREAD";

/** 대화 reader만 만드는 행. 일반 댓글 projection에는 정렬 내부 값을 섞지 않는다. */
export interface TodoConversationRecord extends TodoCommentRecord {
	conversationPosition: TodoConversationPosition;
	/**
	 * 현재 행을 통과해 뒤의 sibling/cousin으로 이어지는 조상 lane depth.
	 * recursive reader가 page 밖 sibling까지 보고 중복 없는 오름차순으로 만든다.
	 */
	continuingAncestorDepths: number[];
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
	position: TodoConversationPosition;
};

export type TodoCommentOverviewCursor = {
	v: 1;
	kind: "overview";
	sort: TodoCommentSort;
	todoId: number;
	rootId: string;
	position: TodoCommentRootPosition;
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
	anchorPosition?: TodoConversationPosition;
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

export type OverviewPageMode = "INITIAL" | "BEFORE" | "AFTER";

export interface ListTodoCommentOverviewParams {
	todoId: number;
	sort: TodoCommentSort;
	size: number;
	mode: OverviewPageMode;
	anchorRootId?: string;
	anchorPosition?: TodoCommentRootPosition;
}

/** Overview root만 가지는 keyset 위치. 일반 댓글 projection에는 노출하지 않는다. */
export interface TodoCommentOverviewRootRecord extends TodoCommentRecord {
	overviewPosition: TodoCommentRootPosition;
}

export interface TodoCommentParticipantAuthorRecord {
	id: string;
	name: string | null;
	profileImage: string | null;
	isTodoOwner: boolean;
}

export interface TodoCommentOverviewItemRecord {
	comment: TodoCommentOverviewRootRecord;
	previewReply: TodoCommentRecord | null;
	totalCount: number;
	participantAuthors: TodoCommentParticipantAuthorRecord[];
}

export interface TodoCommentOverviewWindow {
	items: TodoCommentOverviewItemRecord[];
	previousRecord: TodoCommentOverviewRootRecord | null;
	nextRecord: TodoCommentOverviewRootRecord | null;
	hasPrevious: boolean;
	hasNext: boolean;
}

export interface CreateTodoCommentChainInput {
	todoId: number;
	authorId: string;
	placement: ThreadPlacement;
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
