import { ErrorCode } from "@aido/api/errors";
import { Body, Controller, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import {
  ApiCreatedResponse,
  ApiDoc,
  ApiErrorResponse,
  ApiUnauthorizedError,
  SWAGGER_TAGS,
} from "#api/platform/http/swagger/index";
import { ThrottleByUser } from "#api/platform/throttle/index";

import { CreateInquiry } from "../../../../application/use-cases/inquiries/create-inquiry.use-case.js";
import { CreateInquiryDto, CreateInquiryResponseDto } from "../../../schemas/inquiries/v1/index.js";

const INQUIRY_THROTTLE = { ttl: 60_000, limit: 5 } as const;

@ApiTags(SWAGGER_TAGS.INQUIRIES)
@ApiBearerAuth()
@Controller("inquiries")
export class InquiryController {
  constructor(private readonly createInquiryUseCase: CreateInquiry) {}

  @Post()
  @ThrottleByUser()
  @Throttle({ default: INQUIRY_THROTTLE })
  @ApiDoc({
    summary: "문의 접수",
    operationId: "createInquiry",
    description: `사용자 문의를 관리자 이메일로 발송합니다.

**요청 필드**
- \`category\` (필수): 문의 유형 (BUG_REPORT / FEATURE_REQUEST / PAYMENT / OTHER). PAYMENT는 결제·구독 문의이며 메일 제목에 [결제·구독]으로 표시됩니다.
- \`content\` (필수): 문의 내용 (최대 1000자)

**처리 흐름**
1. 사용자가 문의를 작성하여 전송
2. 문의 내용을 이메일 발송 큐에 담고 바로 응답하며, 관리자 이메일 발송은 이어서 처리됨
3. 발송 큐에 담지 못하거나 발송 예산을 다 쓴 경우 INQUIRY_1501(502) 에러 반환

사용자마다 분당 5회까지 접수하며, 넘으면 429(SYS_0001)를 돌려줍니다.`,
  })
  @ApiCreatedResponse({ type: CreateInquiryResponseDto })
  @ApiErrorResponse({ errorCode: ErrorCode.INQUIRY_1501 })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async createInquiry(
    @CurrentUser() user: CurrentUserPayload,
    @Body({ schema: CreateInquiryDto }) dto: CreateInquiryDto,
  ) {
    await this.createInquiryUseCase.execute({
      userId: user.userId,
      userEmail: user.email,
      category: dto.category,
      content: dto.content,
    });

    return { message: "문의가 접수되었습니다." };
  }
}
