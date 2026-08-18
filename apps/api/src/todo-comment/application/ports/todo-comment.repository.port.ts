import type { TodoComment } from "../../domain/entities/todo-comment.aggregate";
import type {
	CreateTodoCommentChainInput,
	ListTodoCommentsParams,
	TodoCommentChainCreationResult,
	TodoCommentLikeTransition,
	PaginatedTodoCommentRecords,
	TodoCommentChainCommand,
	TodoCommentRecord,
	TodoDetailsRecord,
} from "../types";

export const TODO_COMMENT_REPOSITORY = Symbol("TODO_COMMENT_REPOSITORY");

/** 같은 멱등 키가 원래 요청과 다른 명령에 재사용됐다. */
export class TodoCommentIdempotencyConflict extends Error {
	constructor() {
		super();
		this.name = TodoCommentIdempotencyConflict.name;
	}
}

export interface TodoCommentRepositoryPort {
	findAccessibleTodoDetails(todoId: number, viewerId: string): Promise<TodoDetailsRecord | null>;
	canAccessTodo(todoId: number, viewerId: string): Promise<boolean>;
	findComment(todoId: number, commentId: string): Promise<TodoComment | null>;
	findCommentRecord(todoId: number, commentId: string): Promise<TodoCommentRecord | null>;
	/** parentId가 null이면 최상위 댓글 목록, 값이 있으면 그 댓글의 직계 답글 목록이다. */
	listComments(params: ListTodoCommentsParams): Promise<PaginatedTodoCommentRecords>;
	/** 뿌리 → 부모 순서의 조상. path가 비면 빈 배열을 돌려준다. */
	findAncestors(todoId: number, path: readonly string[]): Promise<TodoCommentRecord[]>;
	findLikedCommentIds(commentIds: readonly string[], viewerId: string): Promise<Set<string>>;
	findUserDisplayName(userId: string): Promise<string | null>;
	/** 정확히 같은 멱등 명령이면 원래 사슬, 처음 보는 키면 null. 일부/불일치는 conflict다. */
	findCommentChainReplay(input: TodoCommentChainCommand): Promise<TodoCommentRecord[] | null>;
	/** replay 확인과 같은 UoW/멱등 잠금 안에서 새 사슬을 한 번에 심는다. */
	createCommentChain(input: CreateTodoCommentChainInput): Promise<TodoCommentChainCreationResult>;
	updateComment(comment: TodoComment): Promise<boolean>;
	deleteComment(comment: TodoComment): Promise<boolean>;
	/** 사슬 길이만큼 댓글 수를 올린다. */
	increaseTodoCommentCount(todoId: number, amount: number): Promise<void>;
	/** 댓글 수가 양수일 때만 내린다. 불변식이 깨졌으면 false. */
	decrementTodoCommentCount(todoId: number): Promise<boolean>;
	/** 삭제되지 않은 부모에만 답글 자리를 하나 추가한다. */
	incrementReplyCount(parentId: string): Promise<boolean>;
	/**
	 * 삭제된 댓글이 목록에서 사라진 만큼 조상의 답글 수를 줄인다.
	 * 답글이 남은 댓글은 묘비로 자리를 지키므로 사라짐이 거기서 멈춘다.
	 */
	dropDeletedFromAncestors(commentId: string, path: readonly string[]): Promise<void>;
	setLike(todoId: number, commentId: string, userId: string): Promise<TodoCommentLikeTransition>;
	/** 좋아요 알림을 보낸 사실을 남긴다 — 껐다 켜도 다시 알리지 않기 위한 도장이다. */
	markLikeNotified(commentId: string, userId: string): Promise<void>;
	removeLike(todoId: number, commentId: string, userId: string): Promise<TodoCommentLikeTransition>;
	recordView(todoId: number, viewerId: string): Promise<{ recorded: boolean; viewCount: number }>;
}
