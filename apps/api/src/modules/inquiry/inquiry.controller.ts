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
		description: "사용자 문의를 관리자 이메일로 발송합니다.",
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
