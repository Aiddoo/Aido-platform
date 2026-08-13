/**
 * GetMemoUseCase 단위 테스트
 *
 * 소유권 확인(MEMO_2001) 후 메모 뷰 반환을 검증한다.
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createMemoRepositoryMock } from "@test/mocks/ports/memo.mock";
import { Memo } from "../../../domain/entities/memo.aggregate";
import {
	MEMO_REPOSITORY,
	type MemoRepositoryPort,
} from "../../ports/memo.repository.port";
import { GetMemoUseCase } from "./get-memo.use-case";

const memoEntity = (): Memo =>
	Memo.reconstitute({
		id: 7,
		userId: "user-1",
		content: "내용",
		isPinned: true,
		sortOrder: 3,
		createdAt: new Date("2026-04-06T00:00:00.000Z"),
		updatedAt: new Date("2026-04-06T00:00:00.000Z"),
	});

describe("GetMemoUseCase — 메모 단건 조회", () => {
	let useCase: GetMemoUseCase;
	let repository: Mocked<MemoRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(GetMemoUseCase)
			.mock<MemoRepositoryPort>(MEMO_REPOSITORY)
			.impl(() => createMemoRepositoryMock())
			.compile();

		useCase = unit;
		repository = unitRef.get<MemoRepositoryPort>(MEMO_REPOSITORY);
	});

	it("메모가 없으면 MEMO_2001을 던진다", async () => {
		// Given
		repository.findByIdAndUserId.mockResolvedValue(null);

		// When & Then
		await expect(
			useCase.execute({ userId: "user-1", memoId: 99 }),
		).rejects.toMatchObject({ errorCode: "MEMO_2001" });
	});

	it("소유한 메모를 소유권 기준으로 조회해 뷰로 반환한다", async () => {
		// Given
		repository.findByIdAndUserId.mockResolvedValue(memoEntity());

		// When
		const result = await useCase.execute({ userId: "user-1", memoId: 7 });

		// Then
		expect(repository.findByIdAndUserId).toHaveBeenCalledWith(7, "user-1");
		expect(result.memo).toEqual(
			expect.objectContaining({
				id: 7,
				userId: "user-1",
				content: "내용",
				isPinned: true,
				sortOrder: 3,
			}),
		);
	});
});
