import type { FeatureDiscoveryResponse } from "@aido/api/contracts/app-config";
import { Controller, Get, Header } from "@nestjs/common";
import { ApiExtraModels, ApiResponse, ApiTags } from "@nestjs/swagger";

import { Public } from "#api/modules/identity/identity-auth-http.public";
import { RawResponse } from "#api/platform/http/decorators/raw-response.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";

import { GetFeatureDiscoveryUseCase } from "../../../application/use-cases/get-feature-discovery.use-case.js";
import { toFeatureDiscoveryResponse } from "./feature-discovery-response.mapper.js";
import {
  FeatureDiscoveryDisabledResponseDto,
  FeatureDiscoveryEnabledResponseDto,
  featureDiscoveryResponseOpenApiSchema,
} from "./feature-discovery.dto.js";

@ApiTags("App Config")
@Controller("app-config")
export class FeatureDiscoveryController {
  readonly #getFeatureDiscovery: GetFeatureDiscoveryUseCase;

  constructor(getFeatureDiscovery: GetFeatureDiscoveryUseCase) {
    this.#getFeatureDiscovery = getFeatureDiscovery;
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
    return toFeatureDiscoveryResponse(this.#getFeatureDiscovery.execute());
  }
}
