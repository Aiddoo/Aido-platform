/**
 * InquiryController 단위 테스트
 *
 * 컨트롤러는 InquiryFacade에만 위임한다. DTO→인자 매핑과 응답 래핑을 검증한다.
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "@/auth/decorators";

import { InquiryFacade } from "../application/facades/inquiry.facade";
import type { CreateInquiryDto } from "./dtos";
import { InquiryController } from "./inquiry.controller";

/** 타입 지정 CreateInquiryDto 팩토리 (as 캐스팅 없이 부분 오버라이드) */
function makeDto(overrides: Partial<CreateInquiryDto> = {}): CreateInquiryDto {
	return {
		category: "BUG_REPORT",
		content: "앱이 갑자기 종료됩니다.",
		...overrides,
	};
}

describe("InquiryController — 문의 컨트롤러", () => {
	let controller: InquiryController;
	let mockFacade: Mocked<InquiryFacade>;

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
		mockFacade = unitRef.get(InquiryFacade);
	});

	describe("createInquiry", () => {
		it("문의 접수 요청을 Facade에 위임하고 메시지를 반환해야 한다", async () => {
			// Given - 문의 생성 DTO와 Facade가 준비되었을 때
			const dto = makeDto();
			mockFacade.createInquiry.mockResolvedValue(undefined);

			// When - createInquiry를 호출하면
			const result = await controller.createInquiry(mockUser, dto);

			// Then - userId/email/category/content를 전달하고 메시지를 반환해야 한다
			expect(mockFacade.createInquiry).toHaveBeenCalledWith(
				mockUser.userId,
				mockUser.email,
				dto.category,
				dto.content,
			);
			expect(result).toEqual({
				message: "문의가 접수되었습니다.",
			});
		});

		it("다른 카테고리의 문의도 동일하게 처리해야 한다", async () => {
			// Given - FEATURE_REQUEST 카테고리의 문의가 있을 때
			const dto = makeDto({
				category: "FEATURE_REQUEST",
				content: "다크 모드를 추가해 주세요.",
			});
			mockFacade.createInquiry.mockResolvedValue(undefined);

			// When - createInquiry를 호출하면
			const result = await controller.createInquiry(mockUser, dto);

			// Then - Facade에 올바른 카테고리를 전달해야 한다
			expect(mockFacade.createInquiry).toHaveBeenCalledWith(
				mockUser.userId,
				mockUser.email,
				"FEATURE_REQUEST",
				dto.content,
			);
			expect(result).toEqual({
				message: "문의가 접수되었습니다.",
			});
		});
	});
});
