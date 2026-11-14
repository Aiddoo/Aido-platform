import { ErrorCode } from "@aido/api/errors";
import { Body, Controller, Param, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Admin } from "#api/modules/identity/identity-auth-http.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiForbiddenError,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";

import { PublishAppReleaseUseCase } from "../../../application/use-cases/publish-app-release.use-case.js";
import { toPublishAppReleaseResponse } from "./app-release-response.mapper.js";
import {
  PublishAppReleaseDto,
  PublishAppReleaseParamDto,
  PublishAppReleaseResponseDto,
} from "./app-release.dto.js";

@ApiTags(SWAGGER_TAGS.ADMIN_SYSTEM)
@ApiBearerAuth()
@Controller({ path: "admin/app-config/app-releases", version: API_VERSION.V1 })
export class AdminAppReleaseController {
  readonly #publishAppRelease: PublishAppReleaseUseCase;

  constructor(publishAppRelease: PublishAppReleaseUseCase) {
    this.#publishAppRelease = publishAppRelease;
  }

  @Put(":platform")
  @Admin()
  @ApiDoc({
    summary: "스토어 공개 버전 반영",
    operationId: "publishAppRelease",
    description: `한 플랫폼의 스토어 최신 공개 버전을 바꿉니다. 재시작 없이 다음 \`GET /v1/app-config/app-version\` 응답부터 반영됩니다.

- 그 스토어에서 실제로 업데이트를 받을 수 있게 된 뒤에 올립니다. 먼저 올리면 사용자가 스토어에 가도 "열기"만 보입니다.
- 플랫폼마다 따로 부릅니다. 같은 값을 다시 보내면 반영 시각만 바뀌고, 이전 공개값을 보내면 되돌아갑니다.`,
  })
  @ApiSuccessResponse({ type: PublishAppReleaseResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiForbiddenError(ErrorCode.ADMIN_1401)
  async publish(
    @Param({ schema: PublishAppReleaseParamDto }) params: PublishAppReleaseParamDto,
    @Body({ schema: PublishAppReleaseDto }) dto: PublishAppReleaseDto,
  ): Promise<PublishAppReleaseResponseDto> {
    const release = await this.#publishAppRelease.execute({
      platform: params.platform,
      latestVersion: dto.latestVersion,
    });
    return toPublishAppReleaseResponse(release);
  }
}
