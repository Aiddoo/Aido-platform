import { TODO_COMMENT_LIMITS } from "@aido/validators";
import type {
	PaginatedTodoComments,
	Todo,
	TodoComment,
	TodoCommentPreview,
	TodoCommentSort,
	TodoDetailsResponse,
} from "@aido/validators";

import type { ThreadPlacement } from "../domain/value-objects/thread-placement.vo";

/**
 * 댓글 한 건의 읽기 모델.
 * 최상위 댓글과 답글은 같은 모양이고 parentId가 있느냐로만 갈린다.
 */
export interface TodoCommentRecord {
	id: string;
	todoId: number;
	/** 직계 부모. null이면 최상위 댓글 */
	parentId: string | null;
	/** 대화의 뿌리. 최상위 댓글이면 null */
	rootId: string | null;
	/** 뿌리 → 부모 순서의 조상 id */
	path: string[];
	depth: number;
	/** @멘션에 쓸 부모 작성자 이름 */
	parentAuthorName: string | null;
	authorId: string;
	authorName: string | null;
	authorProfileImage: string | null;
	todoOwnerId: string;
	content: string | null;
	likeCount: number;
	/** 직계 자식 수 */
	replyCount: number;
	deletedAt: string | null;
	editedAt: string | null;
	createdAt: string;
	/** 함께 실어 보낼 직계 자식 (목록은 한 겹만 채운다) */
	children: TodoCommentRecord[];
}

export interface PaginatedTodoCommentRecords {
	items: TodoCommentRecord[];
	nextCursor: string | null;
	hasNext: boolean;
	size: number;
}

export interface TodoDetailsRecord {
	todo: Todo;
	owner: TodoDetailsResponse["owner"];
	viewCount: number;
	commentCount: number;
	isOwner: boolean;
}

export type LatestTodoCommentCursor = {
	v: 1;
	sort: "LATEST";
	createdAt: string;
	id: string;
};

export type PopularTodoCommentCursor = {
	v: 1;
	sort: "POPULAR";
	likeCount: number;
	replyCount: number;
	createdAt: string;
	id: string;
};

export type TodoCommentCursor = LatestTodoCommentCursor | PopularTodoCommentCursor;

/** parentId가 null이면 최상위 댓글 목록, 값이 있으면 그 댓글의 직계 답글 목록이다. */
export interface ListTodoCommentsParams {
	todoId: number;
	parentId: string | null;
	sort: TodoCommentSort;
	size: number;
	cursor?: TodoCommentCursor;
}

export interface CreateTodoCommentChainInput {
	todoId: number;
	authorId: string;
	/** 사슬이 매달릴 자리. 첫 글이 여기 놓이고 나머지는 앞 글 아래로 이어진다. */
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
	comments: TodoCommentRecord[];
	/** 이번 요청으로 새로 생긴 글 수. 재시도로 전부 이미 있으면 0이다. */
	createdCount: number;
}

export interface TodoCommentLikeTransition {
	commentId: string;
	commentAuthorId: string;
	changed: boolean;
	isLiked: boolean;
	likeCount: number;
	wasEverNotified: boolean;
}

/**
 * 댓글 한 건. 어느 깊이에 있든 같은 모양이다.
 * 자기 답글은 개수로만 알리고, 답글 미리보기는 이 댓글을 감싸는 목록 노드가 채운다.
 */
export function toTodoCommentPreviewResponse(
	record: TodoCommentRecord,
	viewerId: string,
	likedCommentIds: ReadonlySet<string>,
): TodoCommentPreview {
	const isDeleted = record.deletedAt !== null;
	const canEdit = !isDeleted && record.authorId === viewerId;

	return {
		id: record.id,
		todoId: record.todoId,
		parentId: record.parentId,
		rootId: record.rootId,
		depth: record.depth,
		author: isDeleted
			? null
			: {
					id: record.authorId,
					name: record.authorName,
					profileImage: record.authorProfileImage,
					isTodoOwner: record.authorId === record.todoOwnerId,
				},
		content: isDeleted ? null : record.content,
		isDeleted,
		isEdited: record.editedAt !== null,
		likeCount: isDeleted ? 0 : record.likeCount,
		replyCount: record.replyCount,
		hasReplies: record.replyCount > 0,
		// 미리보기를 싣지 못하는 자리라 답글이 있으면 전부 다음 화면에 있다.
		hasMoreReplies: record.replyCount > 0,
		replyTo:
			record.parentId === null
				? null
				: { commentId: record.parentId, authorName: record.parentAuthorName },
		viewer: {
			isLiked: !isDeleted && likedCommentIds.has(record.id),
			canEdit,
			canDelete: canEdit,
			canReply: !isDeleted,
		},
		createdAt: record.createdAt,
		editedAt: record.editedAt,
	};
}

/** 목록에 실리는 댓글. 직계 자식을 한 겹만 미리 보여주고 나머지는 다음 화면으로 넘긴다. */
export function toTodoCommentResponse(
	record: TodoCommentRecord,
	viewerId: string,
	likedCommentIds: ReadonlySet<string>,
): TodoComment {
	const replyPreview = record.children
		.slice(0, TODO_COMMENT_LIMITS.REPLY_PREVIEW_SIZE)
		.map((child) => toTodoCommentPreviewResponse(child, viewerId, likedCommentIds));

	return {
		...toTodoCommentPreviewResponse(record, viewerId, likedCommentIds),
		// 실제로 실어 보낸 미리보기만큼은 더 볼 것이 아니다.
		hasMoreReplies: record.replyCount > replyPreview.length,
		replyPreview,
	};
}

/** 한 페이지를 그대로 응답 모양으로 옮긴다 — 최상위 목록과 답글 목록이 같은 함수를 쓴다. */
export function toPaginatedTodoComments(
	page: PaginatedTodoCommentRecords,
	viewerId: string,
	likedCommentIds: ReadonlySet<string>,
): PaginatedTodoComments {
	return {
		items: page.items.map((record) => toTodoCommentResponse(record, viewerId, likedCommentIds)),
		pagination: {
			nextCursor: page.nextCursor,
			hasNext: page.hasNext,
			size: page.size,
		},
	};
}

/** 응답에 실릴 모든 댓글 id — 좋아요 여부를 한 번의 IN으로 묶기 위해 모은다. */
export function collectCommentIds(records: readonly TodoCommentRecord[]): string[] {
	return records.flatMap((record) => [record.id, ...collectCommentIds(record.children)]);
}
