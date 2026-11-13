import { ErrorCode } from "@aido/api/errors";
import { Body, Controller, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import {
  Admin,
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiBadRequestError,
  ApiForbiddenError,
  ApiNotFoundError,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiCreatedSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";

import { ResolveUserReportUseCase } from "../../../application/use-cases/resolve-user-report.use-case.js";
import { RESOLVE_USER_REPORT_OPERATION_ID } from "./admin-user-report.constants.js";
import { toResolveUserReportResponse } from "./user-report-response.mapper.js";
import {
  ResolveUserReportDto,
  ResolveUserReportParamDto,
  ResolveUserReportResponseDto,
} from "./user-report.dto.js";

@ApiTags(SWAGGER_TAGS.ADMIN_REPORTS)
@ApiBearerAuth()
@Controller({ path: "admin/reports", version: API_VERSION.V1 })
export class AdminUserReportController {
  readonly #resolveUserReportUseCase: ResolveUserReportUseCase;

  constructor(resolveUserReportUseCase: ResolveUserReportUseCase) {
    this.#resolveUserReportUseCase = resolveUserReportUseCase;
  }

  @Post(":reportId/resolution")
  @Admin()
  @ApiDoc({
    summary: "신고 처리 완료",
    operationId: RESOLVE_USER_REPORT_OPERATION_ID,
    description: `접수된 신고에 조치 내용을 남기고 처리 완료(RESOLVED)로 바꿉니다.

**처리 흐름**
1. 신고 접수 이메일의 신고 ID로 대상 콘텐츠와 사용자를 확인합니다
2. 약관 위반이면 콘텐츠 삭제·계정 제한 등 조치를 합니다
3. 이 API로 조치 내용(\`note\`)을 남깁니다

이미 처리한 신고를 다시 처리하면 첫 처리 기록을 그대로 돌려줍니다. 조치 내용은 신고자·신고된 사용자에게 보이지 않습니다.`,
  })
  @ApiCreatedSuccessResponse({ type: ResolveUserReportResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiBadRequestError(ErrorCode.SYS_0002)
  @ApiForbiddenError(ErrorCode.ADMIN_1401)
  @ApiNotFoundError(ErrorCode.REPORT_2255)
  async resolve(
    @CurrentUser() admin: CurrentUserPayload,
    @Param({ schema: ResolveUserReportParamDto }) params: ResolveUserReportParamDto,
    @Body({ schema: ResolveUserReportDto }) dto: ResolveUserReportDto,
  ): Promise<ResolveUserReportResponseDto> {
    const report = await this.#resolveUserReportUseCase.execute({
      reportId: params.reportId,
      adminId: admin.userId,
      note: dto.note,
    });
    return toResolveUserReportResponse(report);
  }
}
