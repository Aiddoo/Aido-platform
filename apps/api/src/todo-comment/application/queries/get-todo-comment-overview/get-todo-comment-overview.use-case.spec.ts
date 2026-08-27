import { ErrorCode } from "@aido/errors";
import { TODO_COMMENT_SORT } from "@aido/validators";
import { createTodoCommentCursorCodecMock, createTodoCommentReaderMock } from "@test/mocks/ports";

import type { TodoCommentOverviewItemRecord, TodoCommentOverviewRootRecord } from "../../types";
import { GetTodoCommentOverviewUseCase } from "./get-todo-comment-overview.use-case";

const TODO_ID = 1;
const VIEWER_ID = "cm1viewer0000000000000001";
const ROOT_ID = "cm1rootcomment000000000001";
const REPLY_ID = "cm1replycomment00000000001";

function createRoot(
	overrides: Partial<TodoCommentOverviewRootRecord> = {},
): TodoCommentOverviewRootRecord {
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
		content: "원문",
		likeCount: 3,
		replyCount: 1,
		deletedAt: null,
		editedAt: null,
		createdAt: "2026-08-26T00:00:00.000Z",
		overviewPosition: { rootLikeCount: 3, rootReplyCount: 1 },
		...overrides,
	};
}

function createOverviewItem(): TodoCommentOverviewItemRecord {
	const comment = createRoot();
	return {
		comment,
		previewReply: {
			...comment,
			id: REPLY_ID,
			parentId: ROOT_ID,
			rootId: ROOT_ID,
			path: [ROOT_ID],
			depth: 1,
			parentAuthorName: comment.authorName,
			content: "미리보기",
		},
		totalCount: 4,
		participantAuthors: [
			{
				id: comment.todoOwnerId,
				name: "할 일 주인",
				profileImage: null,
				isTodoOwner: true,
			},
		],
	};
}

describe("GetTodoCommentOverviewUseCase", () => {
	it("root와 preview를 projection하고 숨은 답글 수와 cursor를 서버가 확정한다", async () => {
		const reader = createTodoCommentReaderMock();
		const cursorCodec = createTodoCommentCursorCodecMock();
		const item = createOverviewItem();
		jest.mocked(reader.canAccessTodo).mockResolvedValue(true);
		jest.mocked(reader.listOverview).mockResolvedValue({
			items: [item],
			previousRecord: createRoot({ id: "cm1previousroot00000000001" }),
			nextRecord: createRoot({ id: "cm1nextroot000000000000001" }),
			hasPrevious: true,
			hasNext: true,
		});
		jest.mocked(reader.findLikedCommentIds).mockResolvedValue(new Set([REPLY_ID]));
		jest
			.mocked(cursorCodec.encodeOverview)
			.mockReturnValueOnce("previous")
			.mockReturnValueOnce("next");
		const useCase = new GetTodoCommentOverviewUseCase(reader, cursorCodec);

		const response = await useCase.execute({
			todoId: TODO_ID,
			viewerId: VIEWER_ID,
			sort: TODO_COMMENT_SORT.LATEST,
			size: 10,
		});

		expect(response.items[0]).toMatchObject({
			comment: { id: ROOT_ID },
			previewReply: { id: REPLY_ID, viewer: { isLiked: true } },
			replySummary: {
				totalCount: 4,
				hiddenCount: 3,
				hasMore: true,
				participantAuthors: [{ isTodoOwner: true }],
			},
		});
		expect(response.pagination).toMatchObject({ hasPrevious: true, hasNext: true, size: 10 });
		expect(response.pagination.previousCursor).not.toBeNull();
		expect(response.pagination.nextCursor).not.toBeNull();
		expect(reader.findLikedCommentIds).toHaveBeenCalledWith([ROOT_ID, REPLY_ID], VIEWER_ID);
	});

	it("POPULAR cursor rank snapshot을 overview reader 경계에 그대로 전달한다", async () => {
		const reader = createTodoCommentReaderMock();
		const cursorCodec = createTodoCommentCursorCodecMock();
		const root = createRoot({ overviewPosition: { rootLikeCount: 9, rootReplyCount: 5 } });
		const cursor = "signed-cursor";
		jest.mocked(cursorCodec.decodeOverview).mockReturnValue({
			v: 1,
			kind: "overview",
			sort: TODO_COMMENT_SORT.POPULAR,
			todoId: root.todoId,
			rootId: root.id,
			position: root.overviewPosition,
		});
		jest.mocked(reader.canAccessTodo).mockResolvedValue(true);
		jest.mocked(reader.listOverview).mockResolvedValue({
			items: [],
			previousRecord: root,
			nextRecord: null,
			hasPrevious: false,
			hasNext: false,
		});
		jest.mocked(reader.findLikedCommentIds).mockResolvedValue(new Set());
		const useCase = new GetTodoCommentOverviewUseCase(reader, cursorCodec);

		await useCase.execute({
			todoId: TODO_ID,
			viewerId: VIEWER_ID,
			sort: TODO_COMMENT_SORT.POPULAR,
			after: cursor,
			size: 30,
		});

		expect(reader.listOverview).toHaveBeenCalledWith(
			expect.objectContaining({
				mode: "AFTER",
				anchorRootId: root.id,
				anchorPosition: root.overviewPosition,
			}),
		);
	});

	it("다른 todo의 cursor는 reader 호출 전에 거부한다", async () => {
		const reader = createTodoCommentReaderMock();
		const cursorCodec = createTodoCommentCursorCodecMock();
		jest.mocked(reader.canAccessTodo).mockResolvedValue(true);
		const useCase = new GetTodoCommentOverviewUseCase(reader, cursorCodec);
		const cursor = "other-todo-cursor";
		const root = createRoot({ todoId: 2 });
		jest.mocked(cursorCodec.decodeOverview).mockReturnValue({
			v: 1,
			kind: "overview",
			sort: TODO_COMMENT_SORT.LATEST,
			todoId: root.todoId,
			rootId: root.id,
			position: root.overviewPosition,
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
		expect(reader.listOverview).not.toHaveBeenCalled();
	});
});
