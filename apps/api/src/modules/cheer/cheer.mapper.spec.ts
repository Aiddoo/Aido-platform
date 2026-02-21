import { CheerBuilder } from "@test/builders";
import { CheerMapper } from "./cheer.mapper";
import type { CheerLimitInfo as ServiceLimitInfo } from "./types";

describe("CheerMapper", () => {
	describe("toDetailDto", () => {
		it("CheerWithRelations를 CheerDetail DTO로 변환한다", () => {
			// Given
			const cheer = CheerBuilder.create("sender-1", "receiver-1")
				.withId(1)
				.withMessage("화이팅!")
				.asUnread()
				.buildWithRelations();

			// When
			const result = CheerMapper.toDetailDto(cheer);

			// Then
			expect(result.id).toBe(1);
			expect(result.senderId).toBe("sender-1");
			expect(result.receiverId).toBe("receiver-1");
			expect(result.message).toBe("화이팅!");
			expect(result.readAt).toBeNull();
			expect(result.sender).toBeDefined();
			expect(result.sender.id).toBe("sender-1");
			expect(typeof result.createdAt).toBe("string");
		});

		it("읽은 응원의 readAt을 ISO 문자열로 변환한다", () => {
			// Given
			const cheer = CheerBuilder.create("sender-1", "receiver-1")
				.asRead()
				.buildWithRelations();

			// When
			const result = CheerMapper.toDetailDto(cheer);

			// Then
			expect(result.readAt).not.toBeNull();
			expect(typeof result.readAt).toBe("string");
		});
	});

	describe("toDto", () => {
		it("CheerWithRelations를 기본 Cheer DTO로 변환한다", () => {
			// Given
			const cheer = CheerBuilder.create("sender-1", "receiver-1")
				.withId(5)
				.buildWithRelations();

			// When
			const result = CheerMapper.toDto(cheer);

			// Then
			expect(result.id).toBe(5);
			expect(result.senderId).toBe("sender-1");
			expect(result.receiverId).toBe("receiver-1");
			expect(result).not.toHaveProperty("sender");
		});
	});

	describe("toDetailDtoList", () => {
		it("배열을 CheerDetail DTO 배열로 변환한다", () => {
			// Given
			const cheers = [
				CheerBuilder.create("s1", "r1").withId(1).buildWithRelations(),
				CheerBuilder.create("s2", "r2").withId(2).buildWithRelations(),
			];

			// When
			const result = CheerMapper.toDetailDtoList(cheers);

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
				dailyLimit: 5,
				used: 3,
				remaining: 2,
			};

			// When
			const result = CheerMapper.toLimitInfoDto(limitInfo);

			// Then
			expect(result).toEqual({
				dailyLimit: 5,
				usedToday: 3,
				remainingToday: 2,
				isUnlimited: false,
			});
		});

		it("무제한인 경우 isUnlimited를 true로 변환한다", () => {
			// Given
			const limitInfo: ServiceLimitInfo = {
				dailyLimit: null,
				used: 10,
				remaining: null,
			};

			// When
			const result = CheerMapper.toLimitInfoDto(limitInfo);

			// Then
			expect(result.isUnlimited).toBe(true);
			expect(result.dailyLimit).toBeNull();
		});
	});
});
