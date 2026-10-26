import { ErrorCode } from "@aido/api/errors";
import { Body, Controller, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiParam, ApiTags } from "@nestjs/swagger";

import {
  Admin,
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import {
  ApiBadRequestError,
  ApiCreatedResponse,
  ApiDoc,
  ApiForbiddenError,
  ApiNotFoundError,
  SWAGGER_TAGS,
} from "#api/platform/http/swagger/index";
import { toISOString } from "#api/shared/domain/date/utils/format";

import { ResolveUserReport } from "../../../application/use-cases/reports/resolve-user-report.use-case.js";
import {
  ResolveUserReportDto,
  ResolveUserReportParamDto,
  ResolveUserReportResponseDto,
} from "../../schemas/reports/index.js";
import { RESOLVE_USER_REPORT_OPERATION_ID } from "./admin-user-report.constants.js";

@ApiTags(SWAGGER_TAGS.ADMIN_REPORTS)
@ApiBearerAuth()
@Controller("admin/reports")
export class AdminUserReportController {
  constructor(private readonly resolveUserReportUseCase: ResolveUserReport) {}

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
  @ApiParam({
    name: "reportId",
    description: "처리할 신고 ID (CUID 25자, 신고 접수 이메일의 신고 ID)",
    example: "clz7x5p8k0123qz0z8z8z8z8z",
  })
  @ApiCreatedResponse({ type: ResolveUserReportResponseDto })
  @ApiBadRequestError(ErrorCode.SYS_0002)
  @ApiForbiddenError(ErrorCode.ADMIN_1401)
  @ApiNotFoundError(ErrorCode.REPORT_2255)
  async resolve(
    @CurrentUser() admin: CurrentUserPayload,
    @Param({ schema: ResolveUserReportParamDto }) params: ResolveUserReportParamDto,
    @Body({ schema: ResolveUserReportDto }) dto: ResolveUserReportDto,
  ): Promise<ResolveUserReportResponseDto> {
    const report = await this.resolveUserReportUseCase.execute({
      reportId: params.reportId,
      adminId: admin.userId,
      note: dto.note,
    });
    const { resolvedAt } = report;

    return {
      message: "신고를 처리 완료로 바꿨습니다.",
      report: {
        id: report.id,
        status: report.status,
        createdAt: toISOString(report.createdAt),
        resolvedAt: resolvedAt == null ? null : toISOString(resolvedAt),
        resolutionNote: report.resolutionNote,
      },
    };
  }
}
