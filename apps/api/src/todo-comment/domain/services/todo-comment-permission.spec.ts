import {
	getTodoCommentViewerPermissions,
	getTodoDetailsPermissions,
} from "./todo-comment-permission";

describe("todo comment permission", () => {
	it("작성자는 살아 있는 댓글을 수정하고 삭제할 수 있다", () => {
		expect(
			getTodoCommentViewerPermissions({
				isDeleted: false,
				isLiked: true,
				authorId: "author-1",
				viewerId: "author-1",
			}),
		).toEqual({ isLiked: true, canEdit: true, canDelete: true, canReply: true });
	});

	it("삭제된 댓글은 작성자에게도 상호작용을 허용하지 않는다", () => {
		expect(
			getTodoCommentViewerPermissions({
				isDeleted: true,
				isLiked: true,
				authorId: "author-1",
				viewerId: "author-1",
			}),
		).toEqual({ isLiked: false, canEdit: false, canDelete: false, canReply: false });
	});

	it("할 일 소유권으로 상세 화면 권한을 결정한다", () => {
		expect(getTodoDetailsPermissions(true)).toEqual({
			canEdit: true,
			canComment: true,
			canNudge: false,
		});
		expect(getTodoDetailsPermissions(false)).toEqual({
			canEdit: false,
			canComment: true,
			canNudge: true,
		});
	});
});
