/**
 * InquiryController 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - Suites: TestBed.solitary()로 자동 Mock 생성
 * - GWT: Given/When/Then 주석으로 테스트 구조화
 *
 * @see https://docs.nestjs.com/recipes/suites
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "@/modules/auth/decorators";

import type { CreateInquiryDto } from "./dtos";
import { InquiryController } from "./inquiry.controller";
import { InquiryService } from "./inquiry.service";

describe("InquiryController", () => {
	let controller: InquiryController;
	let mockInquiryService: Mocked<InquiryService>;

	const mockUser: CurrentUserPayload = {
		userId: "user-123",
		email: "test@example.com",
		sessionId: "session-123",
		role: "USER",
	};

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(InquiryController).compile();

		controller = unit;
		mockInquiryService = unitRef.get(InquiryService);
	});

	describe("createInquiry", () => {
		it("문의 접수 요청을 서비스에 위임하고 메시지를 반환해야 한다", async () => {
			// Given: 문의 생성 DTO와 서비스가 준비되었을 때
			const dto = {
				category: "BUG_REPORT",
				content: "앱이 갑자기 종료됩니다.",
			} as unknown as CreateInquiryDto;
			mockInquiryService.createInquiry.mockResolvedValue(undefined);

			// When: createInquiry를 호출하면
			const result = await controller.createInquiry(mockUser, dto);

			// Then: 서비스에 userId, userEmail, category, content를 전달하고 메시지를 반환해야 한다
			expect(mockInquiryService.createInquiry).toHaveBeenCalledWith({
				userId: mockUser.userId,
				userEmail: mockUser.email,
				category: dto.category,
				content: dto.content,
			});
			expect(result).toEqual({
				message: "문의가 접수되었습니다.",
			});
		});

		it("다른 카테고리의 문의도 동일하게 처리해야 한다", async () => {
			// Given: FEATURE_REQUEST 카테고리의 문의가 있을 때
			const dto = {
				category: "FEATURE_REQUEST",
				content: "다크 모드를 추가해 주세요.",
			} as unknown as CreateInquiryDto;
			mockInquiryService.createInquiry.mockResolvedValue(undefined);

			// When: createInquiry를 호출하면
			const result = await controller.createInquiry(mockUser, dto);

			// Then: 서비스에 올바른 카테고리를 전달해야 한다
			expect(mockInquiryService.createInquiry).toHaveBeenCalledWith(
				expect.objectContaining({
					category: "FEATURE_REQUEST",
				}),
			);
			expect(result).toEqual({
				message: "문의가 접수되었습니다.",
			});
		});
	});
});
