import type { AppVersionResponse, FeatureDiscoveryResponse } from "@aido/api";
import { Controller, Get, Header } from "@nestjs/common";
import { ApiExtraModels, ApiResponse, ApiTags } from "@nestjs/swagger";

import { Public } from "#api/modules/identity/identity-auth-http.public";
import { RawResponse } from "#api/platform/http/decorators/index";
import { ApiDoc } from "#api/platform/http/swagger/index";

import { GetAppVersion } from "../../../application/use-cases/discovery/get-app-version.use-case.js";
import { GetFeatureDiscovery } from "../../../application/use-cases/discovery/get-feature-discovery.use-case.js";
import {
  AppVersionDisabledResponseDto,
  AppVersionEnabledResponseDto,
  FeatureDiscoveryDisabledResponseDto,
  FeatureDiscoveryEnabledResponseDto,
  appVersionResponseOpenApiSchema,
  featureDiscoveryResponseOpenApiSchema,
} from "../../schemas/discovery/index.js";

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
  @ApiDoc({ summary: "Published app versions", operationId: "getAppVersionConfig" })
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
    summary: "Feature discovery rollout configuration",
    operationId: "getFeatureDiscoveryConfig",
    description:
      "Public kill-switch configuration only. Campaign copy and user data are never returned.",
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
