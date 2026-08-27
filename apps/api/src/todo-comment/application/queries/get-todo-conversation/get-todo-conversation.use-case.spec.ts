import { ErrorCode } from "@aido/errors";
import { TODO_COMMENT_SORT } from "@aido/validators";
import { createTodoCommentCursorCodecMock, createTodoCommentReaderMock } from "@test/mocks/ports";

import type { TodoConversationRecord } from "../../types";
import { GetTodoConversationUseCase } from "./get-todo-conversation.use-case";

const TODO_ID = 1;
const VIEWER_ID = "cm1viewer0000000000000001";
const ROOT_ID = "cm1rootcomment000000000001";
const CHILD_ID = "cm1childcomment00000000001";

function createRecord(overrides: Partial<TodoConversationRecord> = {}): TodoConversationRecord {
	return {
		id: ROOT_ID,
		todoId: TODO_ID,
		parentId: null,
		rootId: null,
		path: [],
		depth: 0,
		parentAuthorName: null,
		authorId: "cm1author0000000000000001",
		authorName: "작성자",
		authorProfileImage: null,
		todoOwnerId: "cm1owner00000000000000001",
		content: "댓글",
		likeCount: 0,
		replyCount: 0,
		deletedAt: null,
		editedAt: null,
		createdAt: "2026-08-26T00:00:00.000Z",
		conversationPosition: {
			rootLikeCount: 0,
			rootReplyCount: 0,
		},
		continuingAncestorDepths: [],
		...overrides,
	};
}

describe("GetTodoConversationUseCase", () => {
	it("페이지 경계 밖 자식으로 내려가는 lane과 양방향 cursor를 서버가 확정한다", async () => {
		const reader = createTodoCommentReaderMock();
		const cursorCodec = createTodoCommentCursorCodecMock();
		const first = createRecord();
		const child = createRecord({
			id: CHILD_ID,
			parentId: ROOT_ID,
			rootId: ROOT_ID,
			path: [ROOT_ID],
			depth: 1,
		});
		jest.mocked(reader.canAccessTodo).mockResolvedValue(true);
		jest.mocked(reader.listConversation).mockResolvedValue({
			items: [first, child],
			anchorIndex: null,
			previousRecord: createRecord({ id: "cm1previous000000000000001" }),
			nextRecord: createRecord({
				id: "cm1nextreply0000000000001",
				parentId: CHILD_ID,
				rootId: ROOT_ID,
			}),
			hasPrevious: true,
			hasNext: true,
		});
		jest.mocked(reader.findLikedCommentIds).mockResolvedValue(new Set([CHILD_ID]));
		jest
			.mocked(cursorCodec.encodeConversation)
			.mockReturnValueOnce("previous")
			.mockReturnValueOnce("next");
		const useCase = new GetTodoConversationUseCase(reader, cursorCodec);

		const response = await useCase.execute({
			todoId: TODO_ID,
			viewerId: VIEWER_ID,
			sort: TODO_COMMENT_SORT.LATEST,
			size: 2,
		});

		expect(response.items[1]?.comment.viewer.isLiked).toBe(true);
		expect(response.items).toMatchObject([
			{
				comment: { id: ROOT_ID },
				connection: {
					visualDepth: 0,
					upperLaneDepths: [],
					lowerLaneDepths: [0],
					incomingBranch: null,
				},
				isFocused: false,
			},
			{
				comment: { id: CHILD_ID },
				connection: {
					visualDepth: 1,
					upperLaneDepths: [0],
					lowerLaneDepths: [1],
					incomingBranch: { fromDepth: 0, toDepth: 1 },
				},
				isFocused: false,
			},
		]);
		expect(response.pagination).toMatchObject({
			hasPrevious: true,
			hasNext: true,
		});
		expect(response.pagination.previousCursor).not.toBeNull();
		expect(response.pagination.nextCursor).not.toBeNull();
	});

	it("인접 형제를 직접 잇지 않고 부모 lane에 각각 branch로 연결한다", async () => {
		const reader = createTodoCommentReaderMock();
		const cursorCodec = createTodoCommentCursorCodecMock();
		const firstChild = createRecord({
			id: CHILD_ID,
			parentId: ROOT_ID,
			rootId: ROOT_ID,
			path: [ROOT_ID],
			depth: 1,
			continuingAncestorDepths: [0],
		});
		const sibling = createRecord({
			id: "cm1sibling0000000000000001",
			parentId: ROOT_ID,
			rootId: ROOT_ID,
			path: [ROOT_ID],
			depth: 1,
		});
		jest.mocked(reader.canAccessTodo).mockResolvedValue(true);
		jest.mocked(reader.listConversation).mockResolvedValue({
			items: [firstChild, sibling],
			anchorIndex: null,
			previousRecord: null,
			nextRecord: null,
			hasPrevious: false,
			hasNext: false,
		});
		jest.mocked(reader.findLikedCommentIds).mockResolvedValue(new Set());
		const useCase = new GetTodoConversationUseCase(reader, cursorCodec);

		const response = await useCase.execute({
			todoId: TODO_ID,
			viewerId: VIEWER_ID,
			sort: TODO_COMMENT_SORT.LATEST,
			size: 2,
		});

		expect(response.items).toMatchObject([
			{
				connection: {
					visualDepth: 1,
					upperLaneDepths: [0],
					lowerLaneDepths: [0],
					incomingBranch: { fromDepth: 0, toDepth: 1 },
				},
			},
			{
				connection: {
					visualDepth: 1,
					upperLaneDepths: [0],
					lowerLaneDepths: [],
					incomingBranch: { fromDepth: 0, toDepth: 1 },
				},
			},
		]);
	});

	it("focus는 현재 window index와 잘린 조상 문맥을 한 번만 싣는다", async () => {
		const reader = createTodoCommentReaderMock();
		const cursorCodec = createTodoCommentCursorCodecMock();
		const ancestors = Array.from({ length: 20 }, (_, index) => {
			const id = `cm1ancestor${String(index).padStart(15, "0")}`;
			return createRecord({
				id,
				parentId:
					index === 0
						? "cm1omittedancestor000000002"
						: `cm1ancestor${String(index - 1).padStart(15, "0")}`,
				rootId: ROOT_ID,
				depth: index + 2,
			});
		});
		const allAncestorIds = [
			"cm1omittedancestor000000001",
			"cm1omittedancestor000000002",
			...ancestors.map((ancestor) => ancestor.id),
		];
		const focused = createRecord({
			id: CHILD_ID,
			parentId: ancestors.at(-1)?.id ?? ROOT_ID,
			rootId: ROOT_ID,
			path: allAncestorIds,
			depth: allAncestorIds.length,
		});
		jest.mocked(reader.canAccessTodo).mockResolvedValue(true);
		jest.mocked(reader.listConversation).mockResolvedValue({
			items: [createRecord(), focused],
			anchorIndex: 1,
			previousRecord: null,
			nextRecord: null,
			hasPrevious: false,
			hasNext: false,
		});
		jest.mocked(reader.findAncestors).mockResolvedValue(ancestors);
		jest.mocked(reader.findLikedCommentIds).mockResolvedValue(new Set());
		const useCase = new GetTodoConversationUseCase(reader, cursorCodec);

		const response = await useCase.execute({
			todoId: TODO_ID,
			viewerId: VIEWER_ID,
			sort: TODO_COMMENT_SORT.LATEST,
			focusCommentId: CHILD_ID,
			size: 30,
		});

		expect(response.focus).toMatchObject({
			commentId: CHILD_ID,
			itemIndex: 1,
			omittedAncestorCount: 2,
		});
		expect(response.focus?.precedingAncestors).toHaveLength(20);
		expect(response.focus?.precedingAncestors.at(-1)).toMatchObject({
			connection: {
				visualDepth: 21,
				upperLaneDepths: [20],
				lowerLaneDepths: [21],
				incomingBranch: { fromDepth: 20, toDepth: 21 },
			},
			isFocused: false,
		});
		expect(response.items[1]).toMatchObject({
			comment: { id: CHILD_ID },
			isFocused: true,
		});
		expect(reader.listConversation).toHaveBeenCalledWith(
			expect.objectContaining({ mode: "FOCUS", scope: "THREAD" }),
		);
		expect(reader.findAncestors).toHaveBeenCalledWith(TODO_ID, allAncestorIds.slice(-20));
	});

	it("다른 todo의 cursor는 reader를 호출하기 전에 거부한다", async () => {
		const reader = createTodoCommentReaderMock();
		const cursorCodec = createTodoCommentCursorCodecMock();
		jest.mocked(reader.canAccessTodo).mockResolvedValue(true);
		const useCase = new GetTodoConversationUseCase(reader, cursorCodec);
		const cursor = "other-todo-cursor";
		const anchor = createRecord({ todoId: 2 });
		jest.mocked(cursorCodec.decodeConversation).mockReturnValue({
			v: 1,
			kind: "conversation",
			sort: TODO_COMMENT_SORT.LATEST,
			todoId: anchor.todoId,
			commentId: anchor.id,
			threadId: anchor.id,
			scope: "TODO",
			position: anchor.conversationPosition,
		});

		await expect(
			useCase.execute({
				todoId: TODO_ID,
				viewerId: VIEWER_ID,
				sort: TODO_COMMENT_SORT.LATEST,
				after: cursor,
				size: 30,
			}),
		).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });

		expect(reader.listConversation).not.toHaveBeenCalled();
	});

	it("cursor의 root rank snapshot을 reader boundary에 그대로 전달한다", async () => {
		const reader = createTodoCommentReaderMock();
		const cursorCodec = createTodoCommentCursorCodecMock();
		const anchor = createRecord({
			conversationPosition: { rootLikeCount: 7, rootReplyCount: 4 },
		});
		const cursor = "signed-cursor";
		jest.mocked(cursorCodec.decodeConversation).mockReturnValue({
			v: 1,
			kind: "conversation",
			sort: TODO_COMMENT_SORT.POPULAR,
			todoId: anchor.todoId,
			commentId: anchor.id,
			threadId: anchor.id,
			scope: "TODO",
			position: anchor.conversationPosition,
		});
		jest.mocked(reader.canAccessTodo).mockResolvedValue(true);
		jest.mocked(reader.listConversation).mockResolvedValue({
			items: [anchor],
			anchorIndex: null,
			previousRecord: anchor,
			nextRecord: null,
			hasPrevious: true,
			hasNext: false,
		});
		jest.mocked(reader.findLikedCommentIds).mockResolvedValue(new Set());
		const useCase = new GetTodoConversationUseCase(reader, cursorCodec);

		await useCase.execute({
			todoId: TODO_ID,
			viewerId: VIEWER_ID,
			sort: TODO_COMMENT_SORT.POPULAR,
			after: cursor,
			size: 30,
		});

		expect(reader.listConversation).toHaveBeenCalledWith(
			expect.objectContaining({
				mode: "AFTER",
				scope: "TODO",
				anchorCommentId: anchor.id,
				anchorThreadId: anchor.id,
				anchorPosition: anchor.conversationPosition,
			}),
		);
	});

	it("없거나 tree에서 사라진 focus는 다른 root 대신 빈 대화로 복구한다", async () => {
		const reader = createTodoCommentReaderMock();
		const cursorCodec = createTodoCommentCursorCodecMock();
		jest.mocked(reader.canAccessTodo).mockResolvedValue(true);
		jest.mocked(reader.listConversation).mockResolvedValue(null);
		const useCase = new GetTodoConversationUseCase(reader, cursorCodec);

		await expect(
			useCase.execute({
				todoId: TODO_ID,
				viewerId: VIEWER_ID,
				sort: TODO_COMMENT_SORT.LATEST,
				focusCommentId: CHILD_ID,
				size: 30,
			}),
		).resolves.toEqual({
			items: [],
			focus: null,
			pagination: {
				previousCursor: null,
				nextCursor: null,
				hasPrevious: false,
				hasNext: false,
				size: 30,
			},
		});

		expect(reader.listConversation).toHaveBeenCalledTimes(1);
		expect(reader.findLikedCommentIds).not.toHaveBeenCalled();
	});

	it("후손 때문에 보존된 삭제 댓글은 같은 thread만 돌려주고 focus 표시는 하지 않는다", async () => {
		const reader = createTodoCommentReaderMock();
		const cursorCodec = createTodoCommentCursorCodecMock();
		const deletedFocus = createRecord({
			id: CHILD_ID,
			parentId: ROOT_ID,
			rootId: ROOT_ID,
			path: [ROOT_ID],
			depth: 1,
			deletedAt: "2026-08-26T01:00:00.000Z",
			content: null,
			authorId: "cm1deletedcommentauthor000001",
			authorName: null,
			replyCount: 1,
		});
		jest.mocked(reader.canAccessTodo).mockResolvedValue(true);
		jest.mocked(reader.listConversation).mockResolvedValue({
			items: [createRecord(), deletedFocus],
			anchorIndex: 1,
			previousRecord: null,
			nextRecord: null,
			hasPrevious: false,
			hasNext: false,
		});
		jest.mocked(reader.findLikedCommentIds).mockResolvedValue(new Set());
		const useCase = new GetTodoConversationUseCase(reader, cursorCodec);

		await expect(
			useCase.execute({
				todoId: TODO_ID,
				viewerId: VIEWER_ID,
				sort: TODO_COMMENT_SORT.LATEST,
				focusCommentId: CHILD_ID,
				size: 30,
			}),
		).resolves.toMatchObject({
			items: [
				{ comment: { id: ROOT_ID } },
				{ comment: { id: CHILD_ID, isDeleted: true }, isFocused: false },
			],
			focus: null,
		});

		expect(reader.findAncestors).not.toHaveBeenCalled();
		expect(reader.listConversation).toHaveBeenCalledTimes(1);
	});
});
