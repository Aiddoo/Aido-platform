import type { AppVersionResponse, FeatureDiscoveryResponse } from "@aido/api";
import { Controller, Get, Header } from "@nestjs/common";
import { ApiExtraModels, ApiResponse, ApiTags } from "@nestjs/swagger";

import { Public } from "#api/modules/identity/identity-auth-http.public";
import { RawResponse } from "#api/platform/http/decorators/index";
import { ApiDoc } from "#api/platform/http/swagger/index";

import { GetAppVersion } from "../../../../application/use-cases/discovery/get-app-version.use-case.js";
import { GetFeatureDiscovery } from "../../../../application/use-cases/discovery/get-feature-discovery.use-case.js";
import {
  AppVersionDisabledResponseDto,
  AppVersionEnabledResponseDto,
  FeatureDiscoveryDisabledResponseDto,
  FeatureDiscoveryEnabledResponseDto,
  appVersionResponseOpenApiSchema,
  featureDiscoveryResponseOpenApiSchema,
} from "../../../schemas/discovery/v1/index.js";

@ApiTags("App Config")
@Controller("app-config")
export class AppConfigController {
  constructor(
    private readonly getFeatureDiscoveryUseCase: GetFeatureDiscovery,
    private readonly getAppVersionUseCase: GetAppVersion,
  ) {}

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
    return this.getAppVersionUseCase.execute();
  }

  @Get("feature-discovery")
  @Public()
  @RawResponse()
  @Header("Cache-Control", "private, no-store")
  @ApiDoc({
    summary: "기능 발견 배포 설정 조회",
    operationId: "getFeatureDiscoveryConfig",
    description:
      "로그인 없이 기능 발견의 운영 kill switch 설정만 돌려줍니다. 캠페인 문구와 사용자 데이터는 담지 않습니다. 응답은 캐시하지 않습니다.",
  })
  @ApiExtraModels(FeatureDiscoveryDisabledResponseDto, FeatureDiscoveryEnabledResponseDto)
  @ApiResponse({
    status: 200,
    description: "Feature discovery configuration",
    headers: {
      "Cache-Control": {
        description: "Not cached so the operational kill switch is reflected on the next request",
        schema: {
          type: "string",
          example: "private, no-store",
        },
      },
    },
    schema: featureDiscoveryResponseOpenApiSchema,
  })
  getFeatureDiscovery(): FeatureDiscoveryResponse {
    return this.getFeatureDiscoveryUseCase.execute();
  }
}
