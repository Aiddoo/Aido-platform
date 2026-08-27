import type {
	TodoCommentCursorPagination,
	TodoConversationConnection,
	TodoConversationItem,
} from "@aido/validators";

import type { TodoCommentRecord, TodoConversationRecord } from "../types";
import { toTodoCommentResponse } from "./todo-comment.presenter";

function isDirectParent(
	parent: TodoCommentRecord | null | undefined,
	child: TodoCommentRecord | null | undefined,
): boolean {
	return parent !== null && parent !== undefined && child !== null && child !== undefined
		? child.parentId === parent.id
		: false;
}

/** Wire lane은 순서와 중복을 허용하지 않는다. reader 결과도 경계에서 한 번 정규화한다. */
function normalizeLaneDepths(depths: readonly number[]): number[] {
	return [...new Set(depths)].sort((left, right) => left - right);
}

function toIncomingBranch(depth: number): TodoConversationConnection["incomingBranch"] {
	return depth === 0 ? null : { fromDepth: depth - 1, toDepth: depth };
}

/**
 * recursive reader가 전체 DFS에서 열어 둔 조상 lane에 현재 행의 branch를 더한다.
 * 클라이언트는 parentId·depth·인접 행을 다시 비교하지 않고 이 topology만 그린다.
 */
function toConversationConnection(
	record: TodoConversationRecord,
	nextRecord: TodoConversationRecord | null | undefined,
): TodoConversationConnection {
	const upperLaneDepths =
		record.depth === 0
			? record.continuingAncestorDepths
			: [...record.continuingAncestorDepths, record.depth - 1];
	const lowerLaneDepths = isDirectParent(record, nextRecord)
		? [...record.continuingAncestorDepths, record.depth]
		: record.continuingAncestorDepths;

	return {
		visualDepth: record.depth,
		upperLaneDepths: normalizeLaneDepths(upperLaneDepths),
		lowerLaneDepths: normalizeLaneDepths(lowerLaneDepths),
		incomingBranch: toIncomingBranch(record.depth),
	};
}

export function toTodoConversationItems(input: {
	records: readonly TodoConversationRecord[];
	nextRecord: TodoConversationRecord | null;
	focusCommentId: string | null;
	viewerId: string;
	likedCommentIds: ReadonlySet<string>;
}): TodoConversationItem[] {
	return input.records.map((record, index) => ({
		comment: toTodoCommentResponse(record, input.viewerId, input.likedCommentIds),
		connection: toConversationConnection(
			record,
			index === input.records.length - 1 ? input.nextRecord : input.records[index + 1],
		),
		isFocused: record.id === input.focusCommentId,
	}));
}

/**
 * Focus snapshot은 일반 DFS 목록이 아니라 생략된 조상 사슬이다.
 * 각 행의 부모 lane→아바타 branch와 다음 직계 자식으로 내려가는 lane만 명시해
 * page 안의 sibling branch topology와 섞지 않는다.
 */
export function toTodoConversationAncestorItems(input: {
	records: readonly TodoCommentRecord[];
	viewerId: string;
	likedCommentIds: ReadonlySet<string>;
}): TodoConversationItem[] {
	return input.records.map((record) => ({
		comment: toTodoCommentResponse(record, input.viewerId, input.likedCommentIds),
		connection: {
			visualDepth: record.depth,
			upperLaneDepths: record.depth === 0 ? [] : [record.depth - 1],
			lowerLaneDepths: [record.depth],
			incomingBranch: toIncomingBranch(record.depth),
		},
		isFocused: false,
	}));
}

export function toTodoCommentCursorPagination(input: {
	size: number;
	hasPrevious: boolean;
	hasNext: boolean;
	previousCursor: string | null;
	nextCursor: string | null;
}): TodoCommentCursorPagination {
	return {
		previousCursor: input.previousCursor,
		nextCursor: input.nextCursor,
		hasPrevious: input.hasPrevious,
		hasNext: input.hasNext,
		size: input.size,
	};
}
