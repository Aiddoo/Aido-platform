import {
	TODO_COMMENT_LIMITS,
	todoCommentChainResponseSchema,
	todoCommentCursorPaginationSchema,
	todoCommentOverviewResponseSchema,
	todoConversationResponseSchema,
} from "@aido/validators";

const comment = {
	id: "cm1todoacomment00000000001",
	threadId: "cm1todoacomment00000000001",
	parentId: null,
	depth: 0,
	author: {
		id: "cm1author0000000000000001",
		name: "작성자",
		profileImage: null,
		isTodoOwner: true,
	},
	content: "댓글",
	isDeleted: false,
	isEdited: false,
	likeCount: 0,
	replyCount: 0,
	replyTo: null,
	viewer: { isLiked: false, canEdit: true, canDelete: true, canReply: true },
	createdAt: "2026-08-16T00:00:00.000Z",
	editedAt: null,
};

const reply = {
	...comment,
	id: "cm1todoacomment00000000002",
	parentId: comment.id,
	depth: 1,
};

const pagination = {
	previousCursor: null,
	nextCursor: "next-cursor",
	hasPrevious: false,
	hasNext: true,
	size: 30,
};

describe("todoCommentChainResponseSchema", () => {
	it("성공 응답에는 적어도 댓글 한 건이 있어야 한다", () => {
		expect(todoCommentChainResponseSchema.safeParse({ comments: [] }).success).toBe(false);
		expect(todoCommentChainResponseSchema.safeParse({ comments: [comment] }).success).toBe(true);
	});

	it("요청 사슬 상한보다 많은 댓글 응답을 거부한다", () => {
		expect(
			todoCommentChainResponseSchema.safeParse({
				comments: Array.from({ length: TODO_COMMENT_LIMITS.CHAIN_MAX_SIZE + 1 }, () => comment),
			}).success,
		).toBe(false);
	});
});

describe("todoCommentOverviewResponseSchema", () => {
	it("최상위 댓글, 답글 미리보기, 답글 요약을 한 항목으로 검증한다", () => {
		const result = todoCommentOverviewResponseSchema.safeParse({
			items: [
				{
					comment,
					previewReply: reply,
					replySummary: {
						totalCount: 2,
						hiddenCount: 1,
						hasMore: true,
						participantAuthors: [comment.author],
					},
				},
			],
			pagination,
		});

		expect(result.success).toBe(true);
	});

	it("참여 작성자는 정해진 미리보기 수를 넘길 수 없다", () => {
		const result = todoCommentOverviewResponseSchema.safeParse({
			items: [
				{
					comment,
					previewReply: null,
					replySummary: {
						totalCount: 4,
						hiddenCount: 4,
						hasMore: true,
						participantAuthors: Array.from(
							{ length: TODO_COMMENT_LIMITS.OVERVIEW_PARTICIPANT_MAX_SIZE + 1 },
							() => comment.author,
						),
					},
				},
			],
			pagination,
		});

		expect(result.success).toBe(false);
	});
});

describe("todoConversationResponseSchema", () => {
	it("목록과 focus 조상을 동일한 대화 항목으로 검증한다", () => {
		const rootItem = {
			comment,
			connection: {
				visualDepth: 0,
				upperLaneDepths: [],
				lowerLaneDepths: [0],
				incomingBranch: null,
			},
			isFocused: false,
		};
		const replyItem = {
			comment: reply,
			connection: {
				visualDepth: 1,
				upperLaneDepths: [0],
				lowerLaneDepths: [],
				incomingBranch: { fromDepth: 0, toDepth: 1 },
			},
			isFocused: true,
		};

		const result = todoConversationResponseSchema.safeParse({
			items: [replyItem],
			focus: {
				commentId: reply.id,
				itemIndex: 0,
				precedingAncestors: [rootItem],
				omittedAncestorCount: 0,
			},
			pagination,
		});

		expect(result.success).toBe(true);
		expect(
			todoConversationResponseSchema.safeParse({
				items: [reply],
				focus: null,
				pagination,
			}).success,
		).toBe(false);
	});

	it("lane depth는 중복 없는 오름차순이고 branch는 visual depth와 일치해야 한다", () => {
		const parseConnection = (connection: unknown) =>
			todoConversationResponseSchema.safeParse({
				items: [{ comment: reply, connection, isFocused: false }],
				focus: null,
				pagination,
			});

		expect(
			parseConnection({
				visualDepth: 2,
				upperLaneDepths: [0, 0, 1],
				lowerLaneDepths: [0, 1],
				incomingBranch: { fromDepth: 1, toDepth: 2 },
			}).success,
		).toBe(false);
		expect(
			parseConnection({
				visualDepth: 2,
				upperLaneDepths: [1, 0],
				lowerLaneDepths: [0, 1],
				incomingBranch: { fromDepth: 1, toDepth: 2 },
			}).success,
		).toBe(false);
		expect(
			parseConnection({
				visualDepth: 2,
				upperLaneDepths: [0, 1],
				lowerLaneDepths: [0, 1],
				incomingBranch: { fromDepth: 0, toDepth: 1 },
			}).success,
		).toBe(false);
	});

	it("개요와 대화는 커서 페이지네이션 필드만 공유한다", () => {
		expect(Object.keys(todoCommentCursorPaginationSchema.shape)).toEqual([
			"previousCursor",
			"nextCursor",
			"hasPrevious",
			"hasNext",
			"size",
		]);
	});
});
