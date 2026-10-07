import { ErrorCode } from "@aido/api/errors";
import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import {
  Admin,
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import {
  ApiBadRequestError,
  ApiDoc,
  ApiForbiddenError,
  ApiSuccessResponse,
  SWAGGER_TAGS,
} from "#api/platform/http/swagger/index";

import { GetGrowthSummary } from "../../../application/use-cases/admin/get-growth-summary.use-case.js";
import { toAdminGrowthResponse } from "../../mappers/admin/admin-growth.mapper.js";
import { GrowthSummaryQueryDto, GrowthSummaryResponseDto } from "../../schemas/admin/index.js";

@ApiTags(SWAGGER_TAGS.ADMIN_GROWTH)
@ApiBearerAuth()
@Controller("admin/growth")
export class AdminGrowthController {
  readonly #getGrowthSummary: Pick<GetGrowthSummary, "execute">;

  constructor(getGrowthSummary: GetGrowthSummary) {
    this.#getGrowthSummary = getGrowthSummary;
  }

  @Get("summary")
  @Admin()
  @ApiDoc({
    summary: "성장 및 리텐션 지표 요약",
    operationId: "getAdminGrowthSummary",
    description:
      "가입 cohort 범위의 활성화·D1/D7/D30 리텐션과 종료 현지 날짜 기준 DAU/WAU/MAU를 집계합니다.",
  })
  @ApiSuccessResponse({ type: GrowthSummaryResponseDto })
  @ApiBadRequestError(ErrorCode.SYS_0002)
  @ApiForbiddenError(ErrorCode.ADMIN_1401)
  async getGrowthSummary(
    @CurrentUser() _user: CurrentUserPayload,
    @Query({ schema: GrowthSummaryQueryDto }) query: GrowthSummaryQueryDto,
  ): Promise<GrowthSummaryResponseDto> {
    return toAdminGrowthResponse(await this.#getGrowthSummary.execute(query));
  }
}
