import { ErrorCode } from "@aido/errors";
import {
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Post,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
	ApiBadRequestError,
	ApiCreatedResponse,
	ApiDoc,
	ApiErrorResponse,
	ApiUnauthorizedError,
	SWAGGER_TAGS,
} from "@/common/swagger";

import {
	CurrentUser,
	type CurrentUserPayload,
} from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards";

import { CreateInquiryDto, CreateInquiryResponseDto } from "./dtos";
import { InquiryService } from "./inquiry.service";

/**
 * Inquiry API 컨트롤러
 *
 * 사용자 문의사항 접수 API입니다.
 *
 * ### 문의
 * - POST /inquiries - 문의 등록
 */
@ApiTags(SWAGGER_TAGS.INQUIRIES)
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("inquiries")
export class InquiryController {
	constructor(private readonly inquiryService: InquiryService) {}

	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ApiDoc({
		summary: "문의 접수",
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
	@ApiUnauthorizedError()
	async createInquiry(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: CreateInquiryDto,
	) {
		await this.inquiryService.createInquiry({
			userId: user.userId,
			userEmail: user.email,
			category: dto.category,
			content: dto.content,
		});

		return { message: "문의가 접수되었습니다." };
	}
}
