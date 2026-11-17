import { ErrorCode } from "@aido/api/errors";
import type { SupportedLocale } from "@aido/api/vocabulary";
import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { Public } from "#api/modules/identity/sessions/presentation/http/decorators/public.decorator";
import {
  CurrentRequestSource,
  type RequestSource,
} from "#api/modules/identity/sessions/presentation/http/decorators/request-source.decorator";
import { ResendVerificationUseCase } from "#api/modules/identity/verifications/application/use-cases/resend-verification.use-case";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { ResponseLocale } from "#api/platform/http/decorators/locale.decorator";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import { ApiErrorResponse } from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";
import { RateLimit } from "#api/platform/throttle/rate-limits";

import { MessageResponseDto } from "../../../../sessions/presentation/http/v1/login.dto.js";
import { VerificationRateLimits } from "../verifications.rate-limits.js";
import { ResendVerificationDto } from "./verification.dto.js";

@ApiTags(SWAGGER_TAGS.USER_AUTH)
@Controller({ path: "auth", version: API_VERSION.V1 })
export class VerificationController {
  readonly #resendVerificationUseCase: ResendVerificationUseCase;

  constructor(resendVerificationUseCase: ResendVerificationUseCase) {
    this.#resendVerificationUseCase = resendVerificationUseCase;
  }

  @Post("resend-verification")
  @HttpCode(HttpStatus.OK)
  @Public()
  @RateLimit(VerificationRateLimits.resendVerification)
  @ApiDoc({
    summary: "인증 코드 재발송",
    operationId: "resendVerificationCode",
    description: `
## 🔄 인증 코드 재발송
인증 코드를 다시 발송합니다. 이전 코드는 무효화됩니다.

### 📝 요청 Body
- \`email\`: 가입한 이메일 주소

### ⏱️ 제한사항
- 마지막 발송 후 **1분 이내** 재요청 불가
- IP당 분당 5회까지 호출할 수 있고, 넘으면 429(SYS_0001)입니다

### ⚠️ 에러 케이스
| 코드 | 상황 |
|------|------|
| USER_0604 | 이미 인증 완료된 사용자 |
| VERIFY_0753 | 재발송 쿨다운 (1분). \`error.details.remainingSeconds\`(정수 1~60)에 다시 보낼 수 있을 때까지 남은 초 |
		`,
  })
  @ApiSuccessResponse({ type: MessageResponseDto })
  @ApiErrorResponse({ errorCode: ErrorCode.USER_0604 })
  @ApiErrorResponse({ errorCode: ErrorCode.VERIFY_0753 })
  async resendVerification(
    @Body({ schema: ResendVerificationDto }) dto: ResendVerificationDto,
    @CurrentRequestSource() source: RequestSource,
    @ResponseLocale() emailLocale: SupportedLocale,
  ) {
    const result = await this.#resendVerificationUseCase.execute({
      email: dto.email,
      emailLocale,
      sourceIp: source.ip,
    });
    return result;
  }
}
