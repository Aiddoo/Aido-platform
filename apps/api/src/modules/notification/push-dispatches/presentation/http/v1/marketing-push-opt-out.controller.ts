import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Public } from "#api/modules/identity/sessions/identity-sessions.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";

import { OptOutMarketingPushUseCase } from "../../../application/use-cases/opt-out-marketing-push.use-case.js";
import {
  MarketingPushOptOutDto,
  MarketingPushOptOutResponseDto,
} from "./marketing-push-opt-out.dto.js";

@ApiTags(SWAGGER_TAGS.NOTIFICATIONS)
// 푸시 기기 controller에서 옮겨 와 OpenAPI 문서가 같도록 bearer 표기를 그대로 둔다
@ApiBearerAuth()
@Controller({ path: "notifications", version: API_VERSION.V1 })
export class MarketingPushOptOutController {
  readonly #optOutMarketingPush: OptOutMarketingPushUseCase;

  constructor(optOutMarketingPush: OptOutMarketingPushUseCase) {
    this.#optOutMarketingPush = optOutMarketingPush;
  }

  @Post("marketing-push/opt-out")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiDoc({
    summary: "광고성 앱 푸시 수신 철회",
    operationId: "optOutMarketingPush",
    description:
      "푸시 액션에 포함된 서명 토큰으로 로그인 없이 수신을 철회합니다. 응답의 marketingPushWithdrawnAt(1.15.0+)은 처리한 서버 시각이며, 토큰 유효 여부와 상관없이 항상 줍니다.",
  })
  @ApiSuccessResponse({ type: MarketingPushOptOutResponseDto })
  async optOutMarketingPush(
    @Body({ schema: MarketingPushOptOutDto }) dto: MarketingPushOptOutDto,
  ): Promise<MarketingPushOptOutResponseDto> {
    const { processedAt } = await this.#optOutMarketingPush.execute(dto.token);
    // 토큰 유효 여부를 노출하지 않아 사용자 열거/토큰 탐색을 방지한다. 처리 시각도 항상 같은 모양으로 준다
    return { optedOut: true, marketingPushWithdrawnAt: processedAt.toISOString() };
  }
}
