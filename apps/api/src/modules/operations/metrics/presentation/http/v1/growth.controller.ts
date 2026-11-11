import { ErrorCode } from "@aido/api/errors";
import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import {
  Admin,
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import { ApiForbiddenError } from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";

import { GetGrowthSummaryUseCase } from "../../../application/use-cases/get-growth-summary.use-case.js";
import { GROWTH_METRIC_DEFINITIONS } from "../../../domain/growth-metrics.constants.js";
import { toGrowthSummaryResponse } from "./growth-response.mapper.js";
import { GrowthSummaryQueryDto, GrowthSummaryResponseDto } from "./growth.dto.js";

@ApiTags(SWAGGER_TAGS.ADMIN_GROWTH)
@ApiBearerAuth()
@Controller("admin/growth")
export class GrowthController {
  readonly #getGrowthSummary: Pick<GetGrowthSummaryUseCase, "execute">;

  constructor(getGrowthSummary: GetGrowthSummaryUseCase) {
    this.#getGrowthSummary = getGrowthSummary;
  }

  @Get("summary")
  @Admin()
  @ApiDoc({
    summary: "성장 및 리텐션 지표 요약",
    operationId: "getAdminGrowthSummary",
    description: `가입 cohort 범위의 활성화·D1/D7/D30 리텐션과 종료 현지 날짜 기준 DAU/WAU/MAU·stickiness(DAU/MAU)를 집계합니다. "활성"은 로그인한 사용자의 앱 요청이 있는 사용자 현지 날짜(UserActivityDay.localDate)입니다.

${Object.values(GROWTH_METRIC_DEFINITIONS)
  .map(({ key, definition }) => `- \`${key}\`: ${definition}`)
  .join("\n")}`,
  })
  @ApiSuccessResponse({ type: GrowthSummaryResponseDto })
  @ApiForbiddenError(ErrorCode.ADMIN_1401)
  async getGrowthSummary(
    @CurrentUser() _user: CurrentUserPayload,
    @Query({ schema: GrowthSummaryQueryDto }) query: GrowthSummaryQueryDto,
  ): Promise<GrowthSummaryResponseDto> {
    return toGrowthSummaryResponse(
      await this.#getGrowthSummary.execute({
        ...(query.cohortFrom != null && { cohortFrom: Temporal.PlainDate.from(query.cohortFrom) }),
        ...(query.cohortTo != null && { cohortTo: Temporal.PlainDate.from(query.cohortTo) }),
      }),
    );
  }
}
