import { ErrorCode } from "@aido/api/errors";
import { Body, Controller, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiErrorResponse,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiCreatedSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";
import { ThrottleByUser } from "#api/platform/throttle/user-aware-throttler.guard";

import { CreateInquiryUseCase } from "../../../application/use-cases/create-inquiry.use-case.js";
import { toCreateInquiryResponse } from "./inquiry-response.mapper.js";
import { CreateInquiryDto, CreateInquiryResponseDto } from "./inquiry.dto.js";

const INQUIRY_THROTTLE = { ttl: 60_000, limit: 5 } as const;

@ApiTags(SWAGGER_TAGS.INQUIRIES)
@ApiBearerAuth()
@Controller({ path: "inquiries", version: API_VERSION.V1 })
export class InquiryController {
  readonly #createInquiry: CreateInquiryUseCase;

  constructor(createInquiry: CreateInquiryUseCase) {
    this.#createInquiry = createInquiry;
  }

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
2. 관리자 이메일로 문의 내용이 발송됨
3. 발송 실패 시 INQUIRY_1501(502) 에러 반환

사용자마다 분당 5회까지 접수하며, 넘으면 429(SYS_0001)를 돌려줍니다.`,
  })
  @ApiCreatedSuccessResponse({ type: CreateInquiryResponseDto })
  @ApiErrorResponse({ errorCode: ErrorCode.INQUIRY_1501 })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async createInquiry(
    @CurrentUser() user: CurrentUserPayload,
    @Body({ schema: CreateInquiryDto }) dto: CreateInquiryDto,
  ): Promise<CreateInquiryResponseDto> {
    await this.#createInquiry.execute({
      userId: user.userId,
      userEmail: user.email,
      category: dto.category,
      content: dto.content,
    });

    return toCreateInquiryResponse();
  }
}
