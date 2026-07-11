import { ErrorCode } from "@aido/errors";
import { Body, Controller, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
	ApiBadRequestError,
	ApiCreatedResponse,
	ApiDoc,
	ApiErrorResponse,
	ApiUnauthorizedError,
	SWAGGER_TAGS,
} from "@/shared/presentation/swagger";

import {
	CurrentUser,
	type CurrentUserPayload,
} from "../../auth/presentation/decorators";
import { InquiryFacade } from "../application/facades/inquiry.facade";
import { CreateInquiryDto, CreateInquiryResponseDto } from "./dtos";

@ApiTags(SWAGGER_TAGS.INQUIRIES)
@ApiBearerAuth()
@Controller("inquiries")
export class InquiryController {
	constructor(private readonly inquiryFacade: InquiryFacade) {}

	@Post()
	@ApiDoc({
		summary: "문의 접수",
		operationId: "createInquiry",
		description: `사용자 문의를 관리자 이메일로 발송합니다.

**요청 필드**
- \`category\` (필수): 문의 유형 (BUG_REPORT / FEATURE_REQUEST / OTHER)
- \`content\` (필수): 문의 내용 (최대 1000자)

**처리 흐름**
1. 사용자가 문의를 작성하여 전송
2. 관리자 이메일로 문의 내용이 발송됨
3. 발송 실패 시 INQUIRY_1501 에러 반환`,
	})
	@ApiCreatedResponse({ type: CreateInquiryResponseDto })
	@ApiBadRequestError(ErrorCode.SYS_0002)
	@ApiErrorResponse({ errorCode: ErrorCode.INQUIRY_1501 })
	@ApiUnauthorizedError(ErrorCode.AUTH_0107)
	async createInquiry(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: CreateInquiryDto,
	) {
		await this.inquiryFacade.createInquiry(
			user.userId,
			user.email,
			dto.category,
			dto.content,
		);

		return { message: "문의가 접수되었습니다." };
	}
}
