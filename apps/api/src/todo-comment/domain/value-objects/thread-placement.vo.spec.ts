import { DomainException } from "@/shared/domain";

import { ThreadPlacement } from "./thread-placement.vo";
import { TodoCommentId } from "./todo-comment-id.vo";

const ROOT_ID = "cm1todoacomment00000000001";
const REPLY_ID = "cm1todoacomment00000000002";

describe("ThreadPlacement", () => {
	it("최상위 자리는 부모도 뿌리도 조상도 없다", () => {
		const placement = ThreadPlacement.topLevel();

		expect(placement.parentId).toBeNull();
		expect(placement.rootId).toBeNull();
		expect(placement.path).toEqual([]);
		expect(placement.depth).toBe(0);
		expect(placement.isTopLevel).toBe(true);
	});

	it("최상위 댓글 아래의 답글은 그 댓글을 부모이자 뿌리로 삼는다", () => {
		const placement = ThreadPlacement.topLevel().under(TodoCommentId.create(ROOT_ID));

		expect(placement.parentId?.getValue()).toBe(ROOT_ID);
		expect(placement.rootId?.getValue()).toBe(ROOT_ID);
		expect(placement.path).toEqual([ROOT_ID]);
		expect(placement.depth).toBe(1);
	});

	it("답글의 답글은 뿌리를 이어받고 조상만 쌓인다", () => {
		const placement = ThreadPlacement.topLevel()
			.under(TodoCommentId.create(ROOT_ID))
			.under(TodoCommentId.create(REPLY_ID));

		expect(placement.parentId?.getValue()).toBe(REPLY_ID);
		expect(placement.rootId?.getValue()).toBe(ROOT_ID);
		expect(placement.path).toEqual([ROOT_ID, REPLY_ID]);
		expect(placement.depth).toBe(2);
	});

	it("조상은 뿌리 → 부모 순서로 복원된다", () => {
		const placement = ThreadPlacement.reconstitute({
			parentId: REPLY_ID,
			rootId: ROOT_ID,
			path: [ROOT_ID, REPLY_ID],
		});

		expect(placement.path).toEqual([ROOT_ID, REPLY_ID]);
		expect(placement.isTopLevel).toBe(false);
	});

	it("부모 없이 조상만 있는 자리는 복원하지 못한다", () => {
		expect(() =>
			ThreadPlacement.reconstitute({ parentId: null, rootId: ROOT_ID, path: [ROOT_ID] }),
		).toThrow(DomainException);
	});

	it("경로의 끝이 부모가 아니면 복원하지 못한다", () => {
		expect(() =>
			ThreadPlacement.reconstitute({ parentId: REPLY_ID, rootId: ROOT_ID, path: [ROOT_ID] }),
		).toThrow(DomainException);
	});
});
