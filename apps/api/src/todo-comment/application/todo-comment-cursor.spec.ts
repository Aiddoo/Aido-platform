import { TODO_COMMENT_SORT } from "@aido/validators";

import { decodeTodoCommentCursor, encodeTodoCommentCursor } from "./todo-comment-cursor";
import type { TodoCommentRecord } from "./types";

const record: TodoCommentRecord = {
	id: "cm1todoacomment00000000001",
	todoId: 1,
	parentId: null,
	rootId: null,
	path: [],
	depth: 0,
	parentAuthorName: null,
	authorId: "cm1author0000000000000001",
	authorName: "작성자",
	authorProfileImage: null,
	todoOwnerId: "cm1author0000000000000001",
	content: "댓글",
	likeCount: 3,
	replyCount: 2,
	deletedAt: null,
	editedAt: null,
	createdAt: "2026-08-14T00:00:00.000Z",
	children: [],
};

describe("Todo 댓글 cursor", () => {
	it.each([TODO_COMMENT_SORT.LATEST, TODO_COMMENT_SORT.POPULAR])(
		"%s cursor를 손실 없이 복원한다",
		(sort) => {
			const cursor = encodeTodoCommentCursor(record, sort);

			expect(decodeTodoCommentCursor(cursor, sort)).toMatchObject({
				sort,
				id: record.id,
			});
		},
	);

	it("정렬 종류가 다른 cursor를 거부한다", () => {
		const cursor = encodeTodoCommentCursor(record, TODO_COMMENT_SORT.LATEST);

		expect(() => decodeTodoCommentCursor(cursor, TODO_COMMENT_SORT.POPULAR)).toThrow();
	});

	it("어느 깊이의 답글이든 최상위와 같은 cursor 계약을 쓴다", () => {
		const reply: TodoCommentRecord = {
			...record,
			id: "cm1todoacomment00000000002",
			parentId: record.id,
			rootId: record.id,
			path: [record.id],
			depth: 1,
		};
		const cursor = encodeTodoCommentCursor(reply, TODO_COMMENT_SORT.POPULAR);

		expect(decodeTodoCommentCursor(cursor, TODO_COMMENT_SORT.POPULAR)).toMatchObject({
			sort: TODO_COMMENT_SORT.POPULAR,
			id: reply.id,
			likeCount: reply.likeCount,
			replyCount: reply.replyCount,
		});
	});
});
