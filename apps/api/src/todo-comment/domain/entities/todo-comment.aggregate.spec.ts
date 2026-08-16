import { ErrorCode } from "@aido/errors";

import { DomainException } from "@/shared/domain";

import { TodoComment } from "./todo-comment.aggregate";

function createComment(overrides: Partial<Parameters<typeof TodoComment.reconstitute>[0]> = {}) {
	const createdAt = new Date("2026-08-14T00:00:00.000Z");
	return TodoComment.reconstitute({
		id: "cm1todoacomment00000000001",
		todoId: 1,
		authorId: "cm1author0000000000000001",
		parentId: null,
		rootId: null,
		path: [],
		content: "함께 해요",
		deletedAt: null,
		editedAt: null,
		createdAt,
		updatedAt: createdAt,
		...overrides,
	});
}

describe("TodoComment Aggregate", () => {
	it("작성자가 댓글을 수정한다", () => {
		const comment = createComment();
		const editedAt = new Date("2026-08-14T01:00:00.000Z");

		comment.edit("cm1author0000000000000001", "  수정된 댓글  ", editedAt);

		expect(comment.content).toBe("수정된 댓글");
		expect(comment.editedAt).toEqual(editedAt);
	});

	it("다른 사용자의 수정을 거부한다", () => {
		const comment = createComment();

		try {
			comment.edit("cm1another000000000000001", "수정", new Date());
			throw new Error("예외가 발생해야 합니다.");
		} catch (error) {
			expect(error).toBeInstanceOf(DomainException);
			expect(error).toMatchObject({ errorCode: ErrorCode.TODO_0832 });
		}
	});

	it("삭제 시 원문을 제거하고 같은 요청을 멱등 처리한다", () => {
		const comment = createComment();
		const deletedAt = new Date("2026-08-14T02:00:00.000Z");

		comment.delete("cm1author0000000000000001", deletedAt);
		comment.delete("cm1author0000000000000001", new Date("2026-08-14T03:00:00.000Z"));

		expect(comment.content).toBeNull();
		expect(comment.deletedAt).toEqual(deletedAt);
	});

	it("삭제된 댓글의 상호작용을 거부한다", () => {
		const comment = createComment({
			content: null,
			deletedAt: new Date("2026-08-14T02:00:00.000Z"),
		});

		expect(() => comment.assertCanReceiveInteraction()).toThrow(DomainException);
	});

	it("최상위 댓글은 자기 자신이 대화의 뿌리다", () => {
		const comment = createComment();

		expect(comment.threadRootId.getValue()).toBe("cm1todoacomment00000000001");
	});

	it("답글의 자리는 부모를 이어받고 뿌리는 그대로 둔다", () => {
		const reply = createComment({
			id: "cm1todoacomment00000000002",
			parentId: "cm1todoacomment00000000001",
			rootId: "cm1todoacomment00000000001",
			path: ["cm1todoacomment00000000001"],
		});

		const grandChildPlacement = reply.placeReply();

		expect(grandChildPlacement.parentId?.getValue()).toBe("cm1todoacomment00000000002");
		expect(grandChildPlacement.rootId?.getValue()).toBe("cm1todoacomment00000000001");
		expect(grandChildPlacement.depth).toBe(2);
	});

	it("삭제된 댓글은 답글을 받지 못한다", () => {
		const comment = createComment({
			content: null,
			deletedAt: new Date("2026-08-14T02:00:00.000Z"),
		});

		expect(() => comment.placeReply()).toThrow(DomainException);
	});
});
