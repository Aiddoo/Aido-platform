import type { AppVersionResponse } from "@aido/api/contracts/app-config";
import { Controller, Get, Header } from "@nestjs/common";
import { ApiExtraModels, ApiResponse, ApiTags } from "@nestjs/swagger";

import { Public } from "#api/modules/identity/identity-auth-http.public";
import { RawResponse } from "#api/platform/http/decorators/raw-response.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";

import { GetAppVersionUseCase } from "../../../application/use-cases/get-app-version.use-case.js";
import { toAppVersionResponse } from "./app-version-response.mapper.js";
import {
  AppVersionDisabledResponseDto,
  AppVersionEnabledResponseDto,
  appVersionResponseOpenApiSchema,
} from "./app-version.dto.js";

@ApiTags("App Config")
@Controller("app-config")
export class AppVersionController {
  readonly #getAppVersion: GetAppVersionUseCase;

  constructor(getAppVersion: GetAppVersionUseCase) {
    this.#getAppVersion = getAppVersion;
  }

  @Get("app-version")
  @Public()
  @RawResponse()
  @Header("Cache-Control", "private, no-store")
  @ApiDoc({
    summary: "스토어 최신 앱 버전 조회",
    operationId: "getAppVersionConfig",
    description:
      "로그인 없이 iOS·Android 스토어에 공개된 최신 앱 버전을 돌려줍니다. 설정이 꺼져 있거나 한 플랫폼이라도 버전이 없으면 enabled: false만 보냅니다. 응답은 캐시하지 않습니다.",
  })
  @ApiExtraModels(AppVersionDisabledResponseDto, AppVersionEnabledResponseDto)
  @ApiResponse({
    status: 200,
    description: "App version configuration",
    schema: appVersionResponseOpenApiSchema,
  })
  getAppVersion(): AppVersionResponse {
    return toAppVersionResponse(this.#getAppVersion.execute());
  }
}
