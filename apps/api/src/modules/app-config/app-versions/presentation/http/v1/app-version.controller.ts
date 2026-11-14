import type { AppVersionResponse } from "@aido/api/contracts/app-config";
import { Controller, Get, Header } from "@nestjs/common";
import { ApiExtraModels, ApiResponse, ApiTags } from "@nestjs/swagger";

import { Public } from "#api/modules/identity/identity-auth-http.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { RawResponse } from "#api/platform/http/decorators/raw-response.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";

import { ListAppReleasesUseCase } from "../../../application/use-cases/list-app-releases.use-case.js";
import { toAppVersionResponse } from "./app-version-response.mapper.js";
import {
  AppVersionDisabledResponseDto,
  AppVersionEnabledResponseDto,
  appVersionResponseOpenApiSchema,
} from "./app-version.dto.js";

@ApiTags("App Config")
@Controller({ path: "app-config", version: API_VERSION.V1 })
export class AppVersionController {
  readonly #listAppReleases: ListAppReleasesUseCase;

  constructor(listAppReleases: ListAppReleasesUseCase) {
    this.#listAppReleases = listAppReleases;
  }

  @Get("app-version")
  @Public()
  @RawResponse()
  @Header("Cache-Control", "private, no-store")
  @ApiDoc({
    summary: "스토어 최신 앱 버전 조회",
    operationId: "getAppVersionConfig",
    description:
      "로그인 없이 iOS·Android 스토어에 공개된 최신 앱 버전을 돌려줍니다. 한 플랫폼이라도 반영된 버전이 없으면 enabled: false만 보냅니다. 응답은 캐시하지 않습니다.",
  })
  @ApiExtraModels(AppVersionDisabledResponseDto, AppVersionEnabledResponseDto)
  @ApiResponse({
    status: 200,
    description: "App version configuration",
    schema: appVersionResponseOpenApiSchema,
  })
  async getAppVersion(): Promise<AppVersionResponse> {
    return toAppVersionResponse(await this.#listAppReleases.execute());
  }
}
