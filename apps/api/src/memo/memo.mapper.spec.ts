/**
 * MemoMapper 매퍼 단위 테스트
 *
 * @description
 * MemoMapper의 변환 로직을 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test memo.mapper
 * ```
 */
import { MemoBuilder } from "@test/builders";
import { MemoMapper } from "./memo.mapper";

describe("MemoMapper — 메모 매퍼", () => {
	beforeEach(() => {
		MemoBuilder.resetIdCounter();
	});

	describe("toResponse", () => {
		it("Memo 엔티티를 응답 DTO로 변환한다", () => {
			// Given
			const memo = MemoBuilder.create("user-1")
				.withId(1)
				.withContent("테스트 메모")
				.withSortOrder(3)
				.build();

			// When
			const result = MemoMapper.toResponse(memo);

			// Then
			expect(result.id).toBe(1);
			expect(result.userId).toBe("user-1");
			expect(result.content).toBe("테스트 메모");
			expect(result.isPinned).toBe(false);
			expect(result.sortOrder).toBe(3);
			expect(typeof result.createdAt).toBe("string");
			expect(typeof result.updatedAt).toBe("string");
		});

		it("고정된 메모의 isPinned을 true로 변환한다", () => {
			// Given
			const memo = MemoBuilder.create("user-1").pinned().build();

			// When
			const result = MemoMapper.toResponse(memo);

			// Then
			expect(result.isPinned).toBe(true);
		});

		it("Date를 ISO 문자열로 변환한다", () => {
			// Given
			const fixedDate = new Date("2025-01-15T09:00:00.000Z");
			const memo = MemoBuilder.create("user-1")
				.withCreatedAt(fixedDate)
				.build();

			// When
			const result = MemoMapper.toResponse(memo);

			// Then
			expect(result.createdAt).toBe("2025-01-15T09:00:00.000Z");
		});
	});

	describe("toManyResponse", () => {
		it("Memo 배열을 응답 DTO 배열로 변환한다", () => {
			// Given
			const memos = [
				MemoBuilder.create("user-1").withId(1).withContent("메모 1").build(),
				MemoBuilder.create("user-2").withId(2).withContent("메모 2").build(),
			];

			// When
			const result = MemoMapper.toManyResponse(memos);

			// Then
			expect(result).toHaveLength(2);
			expect(result[0]?.id).toBe(1);
			expect(result[0]?.content).toBe("메모 1");
			expect(result[1]?.id).toBe(2);
			expect(result[1]?.content).toBe("메모 2");
		});

		it("빈 배열을 전달하면 빈 배열을 반환한다", () => {
			// Given
			const memos: ReturnType<typeof MemoBuilder.prototype.build>[] = [];

			// When
			const result = MemoMapper.toManyResponse(memos);

			// Then
			expect(result).toEqual([]);
		});
	});
});
