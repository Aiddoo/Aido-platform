import type { TodoCommentRecord, TodoConversationRecord } from "../types";
import {
	toTodoConversationAncestorItems,
	toTodoConversationItems,
} from "./todo-conversation.presenter";

const VIEWER_ID = "viewer";
const ROOT_ID = "root";

function createRecord(
	id: string,
	depth: number,
	parentId: string | null,
	continuingAncestorDepths: number[] = [],
): TodoConversationRecord {
	return {
		id,
		todoId: 1,
		parentId,
		rootId: depth === 0 ? null : ROOT_ID,
		path: [],
		depth,
		parentAuthorName: null,
		authorId: `author-${id}`,
		authorName: id,
		authorProfileImage: null,
		todoOwnerId: "owner",
		content: id,
		likeCount: 0,
		replyCount: 0,
		deletedAt: null,
		editedAt: null,
		createdAt: "2026-08-26T00:00:00.000Z",
		conversationPosition: { rootLikeCount: 0, rootReplyCount: 0 },
		continuingAncestorDepths,
	};
}

function toItems(
	records: TodoConversationRecord[],
	boundary: {
		nextRecord?: TodoConversationRecord | null;
	} = {},
) {
	return toTodoConversationItems({
		records,
		nextRecord: boundary.nextRecord ?? null,
		focusCommentId: null,
		viewerId: VIEWER_ID,
		likedCommentIds: new Set(),
	});
}

describe("todo conversation presenter", () => {
	it("sibling subtree를 지나는 조상 lane과 각 답글 branch를 완성한다", () => {
		const root = createRecord(ROOT_ID, 0, null);
		const firstChild = createRecord("first-child", 1, ROOT_ID, [0]);
		const grandchild = createRecord("grandchild", 2, firstChild.id, [0]);
		const secondChild = createRecord("second-child", 1, ROOT_ID);

		const result = toItems([root, firstChild, grandchild, secondChild]);

		expect(result.map((item) => item.connection)).toEqual([
			{
				visualDepth: 0,
				upperLaneDepths: [],
				lowerLaneDepths: [0],
				incomingBranch: null,
			},
			{
				visualDepth: 1,
				upperLaneDepths: [0],
				lowerLaneDepths: [0, 1],
				incomingBranch: { fromDepth: 0, toDepth: 1 },
			},
			{
				visualDepth: 2,
				upperLaneDepths: [0, 1],
				lowerLaneDepths: [0],
				incomingBranch: { fromDepth: 1, toDepth: 2 },
			},
			{
				visualDepth: 1,
				upperLaneDepths: [0],
				lowerLaneDepths: [],
				incomingBranch: { fromDepth: 0, toDepth: 1 },
			},
		]);
	});

	it("page 마지막 자식과 page 첫 형제에도 경계 밖 topology를 보존한다", () => {
		const parent = createRecord("parent", 1, ROOT_ID, [0]);
		const child = createRecord("child", 2, parent.id, [0]);
		const sibling = createRecord("sibling", 1, ROOT_ID);

		expect(toItems([parent], { nextRecord: child })[0]?.connection).toEqual({
			visualDepth: 1,
			upperLaneDepths: [0],
			lowerLaneDepths: [0, 1],
			incomingBranch: { fromDepth: 0, toDepth: 1 },
		});
		expect(toItems([sibling])[0]?.connection).toEqual({
			visualDepth: 1,
			upperLaneDepths: [0],
			lowerLaneDepths: [],
			incomingBranch: { fromDepth: 0, toDepth: 1 },
		});
	});

	it("자손을 남긴 tombstone도 동일한 topology node로 취급한다", () => {
		const tombstone = {
			...createRecord("deleted-parent", 1, ROOT_ID),
			content: null,
			deletedAt: "2026-08-26T01:00:00.000Z",
			replyCount: 1,
		};
		const child = createRecord("surviving-child", 2, tombstone.id);

		expect(toItems([tombstone, child]).map((item) => item.connection)).toEqual([
			{
				visualDepth: 1,
				upperLaneDepths: [0],
				lowerLaneDepths: [1],
				incomingBranch: { fromDepth: 0, toDepth: 1 },
			},
			{
				visualDepth: 2,
				upperLaneDepths: [1],
				lowerLaneDepths: [],
				incomingBranch: { fromDepth: 1, toDepth: 2 },
			},
		]);
	});

	it("focus preceding ancestors는 생략 여부와 무관하게 직계 사슬만 그린다", () => {
		const root = createRecord(ROOT_ID, 0, null);
		const parent = createRecord("parent", 1, ROOT_ID);

		const result = toTodoConversationAncestorItems({
			records: [root, parent] satisfies TodoCommentRecord[],
			viewerId: VIEWER_ID,
			likedCommentIds: new Set(),
		});

		expect(result.map((item) => item.connection)).toEqual([
			{
				visualDepth: 0,
				upperLaneDepths: [],
				lowerLaneDepths: [0],
				incomingBranch: null,
			},
			{
				visualDepth: 1,
				upperLaneDepths: [0],
				lowerLaneDepths: [1],
				incomingBranch: { fromDepth: 0, toDepth: 1 },
			},
		]);
	});
});
