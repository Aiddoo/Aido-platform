import { TODO_COMMENT_LIMITS, todoCommentChainResponseSchema } from "@aido/validators";

const comment = {
	id: "cm1todoacomment00000000001",
	todoId: 1,
	parentId: null,
	rootId: null,
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
	hasReplies: false,
	hasMoreReplies: false,
	replyTo: null,
	viewer: { isLiked: false, canEdit: true, canDelete: true, canReply: true },
	createdAt: "2026-08-16T00:00:00.000Z",
	editedAt: null,
	replyPreview: [],
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
