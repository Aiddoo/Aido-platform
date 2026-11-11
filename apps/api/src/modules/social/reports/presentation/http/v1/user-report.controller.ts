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
  ApiBadRequestError,
  ApiNotFoundError,
  ApiTooManyRequestsError,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiCreatedResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";
import { THROTTLED_DESCRIPTION } from "#api/platform/throttle/throttle.constants";
import { ThrottleByUser } from "#api/platform/throttle/user-aware-throttler.guard";

import { ReportContentUseCase } from "../../../application/use-cases/report-content.use-case.js";
import { toCreateUserReportResponse } from "./user-report-response.mapper.js";
import { CreateUserReportDto, CreateUserReportResponseDto } from "./user-report.dto.js";

const REPORT_THROTTLE = { ttl: 60_000, limit: 10 } as const;

@ApiTags(SWAGGER_TAGS.REPORTS)
@ApiBearerAuth()
@Controller({ path: "reports", version: API_VERSION.V1 })
export class UserReportController {
  readonly #reportContentUseCase: ReportContentUseCase;

  constructor(reportContentUseCase: ReportContentUseCase) {
    this.#reportContentUseCase = reportContentUseCase;
  }

  @Post()
  @ThrottleByUser()
  @Throttle({ default: REPORT_THROTTLE })
  @ApiDoc({
    summary: "사용자·콘텐츠 신고",
    operationId: "createUserReport",
    description: `다른 사용자의 프로필이나 할 일·댓글·콕·응원 메시지를 신고합니다.

**요청 필드**
- \`targetUserId\` (필수): 신고할 콘텐츠를 만든 사용자 ID
- \`targetType\` (필수): PROFILE / TODO / COMMENT / NUDGE_MESSAGE / CHEER_MESSAGE
- \`targetId\`: 콘텐츠 ID. 할 일·콕·응원은 숫자 ID, 댓글은 CUID이며 PROFILE이면 보내지 않습니다
- \`reason\` (필수): SPAM / HARASSMENT / INAPPROPRIATE / IMPERSONATION / OTHER
- \`detail\` (선택): 상세 내용 (최대 500자)

**처리 흐름**
1. 신고를 저장하고 운영자에게 이메일로 알립니다. 이메일 발송에 실패해도 신고는 접수됩니다
2. 같은 대상을 24시간 안에 다시 신고하면 새로 접수하지 않고 기존 신고를 돌려줍니다
3. 최근 24시간 동안 20건을 넘게 신고하면 REPORT_2254로 거부합니다

신고해도 상대에게는 알리지 않습니다. 상대를 더 보고 싶지 않다면 차단 API를 함께 사용합니다.`,
  })
  @ApiCreatedResponse({ type: CreateUserReportResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiBadRequestError(ErrorCode.REPORT_2251)
  @ApiBadRequestError(ErrorCode.REPORT_2253)
  @ApiNotFoundError(ErrorCode.REPORT_2252)
  @ApiTooManyRequestsError(ErrorCode.REPORT_2254)
  @ApiTooManyRequestsError(ErrorCode.SYS_0001, THROTTLED_DESCRIPTION)
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body({ schema: CreateUserReportDto }) dto: CreateUserReportDto,
  ): Promise<CreateUserReportResponseDto> {
    const report = await this.#reportContentUseCase.execute({
      reporterId: user.userId,
      targetUserId: dto.targetUserId,
      targetType: dto.targetType,
      targetId: dto.targetId,
      reason: dto.reason,
      detail: dto.detail,
    });
    return toCreateUserReportResponse(report);
  }
}
