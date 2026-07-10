/**
 * ReorderMemoHandler 단위 테스트
 *
 * 도메인 계획을 저장소 시프트/갱신 호출로 적용하는지 검증한다.
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { Memo } from "../../../domain/entities/memo.entity";
import {
	MEMO_REPOSITORY,
	type MemoRepositoryPort,
} from "../../ports/memo.repository.port";
import { ReorderMemoCommand } from "./reorder-memo.command";
import { ReorderMemoHandler } from "./reorder-memo.handler";

const memoAt = (id: number, sortOrder: number): Memo =>
	Memo.reconstitute({
		id,
		userId: "user-1",
		content: "내용",
		isPinned: false,
		sortOrder,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

describe("ReorderMemoHandler — 메모 순서 변경 핸들러", () => {
	let handler: ReorderMemoHandler;
	let uow: Mocked<UnitOfWorkPort>;
	let repository: Mocked<MemoRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(ReorderMemoHandler).compile();
		handler = unit;
		uow = unitRef.get(UNIT_OF_WORK);
		repository = unitRef.get(MEMO_REPOSITORY);

		uow.run.mockImplementation(async (fn) => fn());
	});

	it("메모가 없으면 MEMO_2001", async () => {
		repository.findByIdAndUserId.mockResolvedValue(null);
		await expect(
			handler.execute(new ReorderMemoCommand("user-1", 1, "before", 2)),
		).rejects.toMatchObject({ errorCode: "MEMO_2001" });
	});

	it("자기 자신을 기준으로 지정하면 변경 없이 반환한다", async () => {
		repository.findByIdAndUserId.mockResolvedValue(memoAt(1, 3));
		await handler.execute(new ReorderMemoCommand("user-1", 1, "before", 1));
		expect(repository.shiftSortOrders).not.toHaveBeenCalled();
		expect(repository.updateSortOrder).not.toHaveBeenCalled();
	});

	it("기준 메모가 없으면 MEMO_2002", async () => {
		repository.findByIdAndUserId
			.mockResolvedValueOnce(memoAt(1, 5))
			.mockResolvedValueOnce(null);
		await expect(
			handler.execute(new ReorderMemoCommand("user-1", 1, "before", 2)),
		).rejects.toMatchObject({ errorCode: "MEMO_2002" });
	});

	it("상대 이동: 계획대로 시프트 후 새 sortOrder로 갱신한다", async () => {
		// current 5, target sortOrder 2, before → shift {2..4,+1}, newSortOrder 2
		repository.findByIdAndUserId
			.mockResolvedValueOnce(memoAt(1, 5))
			.mockResolvedValueOnce(memoAt(2, 2));
		repository.updateSortOrder.mockResolvedValue(memoAt(1, 2));

		await handler.execute(new ReorderMemoCommand("user-1", 1, "before", 2));

		expect(repository.shiftSortOrders).toHaveBeenCalledWith("user-1", 2, 4, 1);
		expect(repository.updateSortOrder).toHaveBeenCalledWith(1, 2);
	});

	it("맨 뒤 이동: max 조회 후 뒤 블록을 당기고 max로 갱신한다", async () => {
		repository.findByIdAndUserId.mockResolvedValue(memoAt(1, 3));
		repository.getMaxSortOrder.mockResolvedValue(9);
		repository.updateSortOrder.mockResolvedValue(memoAt(1, 9));

		await handler.execute(new ReorderMemoCommand("user-1", 1, "after"));

		expect(repository.shiftSortOrders).toHaveBeenCalledWith(
			"user-1",
			4,
			null,
			-1,
		);
		expect(repository.updateSortOrder).toHaveBeenCalledWith(1, 9);
	});
});
