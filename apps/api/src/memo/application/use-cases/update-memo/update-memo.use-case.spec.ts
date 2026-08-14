/**
 * UpdateMemoUseCase 단위 테스트
 *
 * 소유권 확인(MEMO_2001) → 내용 불변식(MemoContent) → 저장을 검증한다.
 * 길이 불변식은 도메인 값 객체(MemoContent)가 소유하며 빈 내용은 SYS_0002.
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createMemoRepositoryMock } from "@test/mocks/ports/memo.mock";

import { Memo } from "../../../domain/entities/memo.aggregate";
import { MEMO_REPOSITORY, type MemoRepositoryPort } from "../../ports/memo.repository.port";
import { UpdateMemoUseCase } from "./update-memo.use-case";

const memoEntity = (content: string): Memo =>
	Memo.reconstitute({
		id: 1,
		userId: "user-1",
		content,
		isPinned: false,
		sortOrder: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

describe("UpdateMemoUseCase — 메모 내용 수정", () => {
	let useCase: UpdateMemoUseCase;
	let repository: Mocked<MemoRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(UpdateMemoUseCase)
			.mock<MemoRepositoryPort>(MEMO_REPOSITORY)
			.impl(() => createMemoRepositoryMock())
			.compile();

		useCase = unit;
		repository = unitRef.get<MemoRepositoryPort>(MEMO_REPOSITORY);
	});

	it("메모가 없으면 MEMO_2001을 던지고 수정하지 않는다", async () => {
		// Given
		repository.findByIdAndUserId.mockResolvedValue(null);

		// When & Then
		await expect(
			useCase.execute({ userId: "user-1", memoId: 99, content: "새 내용" }),
		).rejects.toMatchObject({ errorCode: "MEMO_2001" });
		expect(repository.updateContent).not.toHaveBeenCalled();
	});

	it("소유한 메모 내용을 수정하고 갱신된 뷰를 반환한다", async () => {
		// Given
		repository.findByIdAndUserId.mockResolvedValue(memoEntity("이전 내용"));
		repository.updateContent.mockResolvedValue(memoEntity("새 내용"));

		// When
		const result = await useCase.execute({
			userId: "user-1",
			memoId: 1,
			content: "새 내용",
		});

		// Then
		expect(repository.updateContent).toHaveBeenCalledWith(1, "새 내용");
		expect(result.message).toBe("메모가 수정되었습니다.");
		expect(result.memo.content).toBe("새 내용");
	});

	it("빈 내용이면 도메인 불변식(SYS_0002)을 던지고 저장하지 않는다", async () => {
		// Given - 소유권은 통과하되 내용 불변식에서 거부
		repository.findByIdAndUserId.mockResolvedValue(memoEntity("이전 내용"));

		// When & Then
		await expect(
			useCase.execute({ userId: "user-1", memoId: 1, content: "" }),
		).rejects.toMatchObject({ errorCode: "SYS_0002" });
		expect(repository.updateContent).not.toHaveBeenCalled();
	});
});
