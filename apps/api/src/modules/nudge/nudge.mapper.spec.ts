/**
 * NudgeMapper 매퍼 단위 테스트
 *
 * @description
 * NudgeMapper의 변환 로직을 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test nudge.mapper
 * ```
 */
import { NudgeBuilder } from "@test/builders";
import { NudgeMapper } from "./nudge.mapper";
import type { NudgeLimitInfo as ServiceLimitInfo } from "./types";

describe("NudgeMapper — 찔러보기 매퍼", () => {
	describe("toDetailDto", () => {
		it("NudgeWithRelations를 NudgeDetail DTO로 변환한다", () => {
			// Given
			const nudge = NudgeBuilder.create("sender-1", "receiver-1", 10)
				.withId(1)
				.withMessage("얼른 해!")
				.asUnread()
				.buildWithRelations();

			// When
			const result = NudgeMapper.toDetailDto(nudge);

			// Then
			expect(result.id).toBe(1);
			expect(result.senderId).toBe("sender-1");
			expect(result.receiverId).toBe("receiver-1");
			expect(result.todoId).toBe(10);
			expect(result.message).toBe("얼른 해!");
			expect(result.readAt).toBeNull();
			expect(result.sender).toBeDefined();
			expect(result.sender.id).toBe("sender-1");
			expect(result.todo).toBeDefined();
			expect(result.todo.id).toBe(10);
			expect(typeof result.createdAt).toBe("string");
		});

		it("읽은 콕찌르기의 readAt을 ISO 문자열로 변환한다", () => {
			// Given
			const nudge = NudgeBuilder.create("sender-1", "receiver-1", 10)
				.asRead()
				.buildWithRelations();

			// When
			const result = NudgeMapper.toDetailDto(nudge);

			// Then
			expect(result.readAt).not.toBeNull();
			expect(typeof result.readAt).toBe("string");
		});
	});

	describe("toDto", () => {
		it("NudgeWithRelations를 기본 Nudge DTO로 변환한다", () => {
			// Given
			const nudge = NudgeBuilder.create("sender-1", "receiver-1", 10)
				.withId(5)
				.buildWithRelations();

			// When
			const result = NudgeMapper.toDto(nudge);

			// Then
			expect(result.id).toBe(5);
			expect(result.todoId).toBe(10);
			expect(result).not.toHaveProperty("sender");
			expect(result).not.toHaveProperty("todo");
		});
	});

	describe("toDetailDtoList", () => {
		it("배열을 NudgeDetail DTO 배열로 변환한다", () => {
			// Given
			const nudges = [
				NudgeBuilder.create("s1", "r1", 1).withId(1).buildWithRelations(),
				NudgeBuilder.create("s2", "r2", 2).withId(2).buildWithRelations(),
			];

			// When
			const result = NudgeMapper.toDetailDtoList(nudges);

			// Then
			expect(result).toHaveLength(2);
			expect(result[0]?.id).toBe(1);
			expect(result[1]?.id).toBe(2);
		});
	});

	describe("toLimitInfoDto", () => {
		it("일일 제한이 있는 경우 limitInfo를 변환한다", () => {
			// Given
			const limitInfo: ServiceLimitInfo = {
				dailyLimit: 3,
				used: 1,
				remaining: 2,
			};

			// When
			const result = NudgeMapper.toLimitInfoDto(limitInfo);

			// Then
			expect(result).toEqual({
				dailyLimit: 3,
				usedToday: 1,
				remainingToday: 2,
				isUnlimited: false,
			});
		});

		it("무제한인 경우 isUnlimited를 true로 변환한다", () => {
			// Given
			const limitInfo: ServiceLimitInfo = {
				dailyLimit: null,
				used: 5,
				remaining: null,
			};

			// When
			const result = NudgeMapper.toLimitInfoDto(limitInfo);

			// Then
			expect(result.isUnlimited).toBe(true);
			expect(result.dailyLimit).toBeNull();
		});
	});
});
