/**
 * GetMemoResourceLimitUseCase 단위 테스트
 *
 * 현재 메모 개수와 사용자당 한도(MEMO_LIMITS.MAX_PER_USER) 반환을 검증한다.
 */

import { MEMO_LIMITS } from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createMemoRepositoryMock } from "@test/mocks/ports/memo.mock";

import { MEMO_REPOSITORY, type MemoRepositoryPort } from "../../ports/memo.repository.port";
import { GetMemoResourceLimitUseCase } from "./get-memo-resource-limit.use-case";

describe("GetMemoResourceLimitUseCase — 메모 리소스 제한 조회", () => {
	let useCase: GetMemoResourceLimitUseCase;
	let repository: Mocked<MemoRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(GetMemoResourceLimitUseCase)
			.mock<MemoRepositoryPort>(MEMO_REPOSITORY)
			.impl(() => createMemoRepositoryMock())
			.compile();

		useCase = unit;
		repository = unitRef.get<MemoRepositoryPort>(MEMO_REPOSITORY);
	});

	it("현재 개수를 저장소에서 세어 한도와 함께 반환한다", async () => {
		// Given
		repository.countByUserId.mockResolvedValue(5);

		// When
		const result = await useCase.execute({ userId: "user-1" });

		// Then
		expect(repository.countByUserId).toHaveBeenCalledWith("user-1");
		expect(result).toEqual({
			currentCount: 5,
			maxPerUser: MEMO_LIMITS.MAX_PER_USER,
		});
	});

	it("메모가 없으면 currentCount 0을 반환한다", async () => {
		// Given
		repository.countByUserId.mockResolvedValue(0);

		// When
		const result = await useCase.execute({ userId: "user-1" });

		// Then
		expect(result.currentCount).toBe(0);
		expect(result.maxPerUser).toBe(MEMO_LIMITS.MAX_PER_USER);
	});
});
