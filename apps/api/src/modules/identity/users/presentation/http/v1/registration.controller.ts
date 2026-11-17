import { ErrorCode } from "@aido/api/errors";
import type { SupportedLocale } from "@aido/api/vocabulary";
import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { Public } from "#api/modules/identity/sessions/presentation/http/decorators/public.decorator";
import {
  CurrentRequestSource,
  type RequestSource,
} from "#api/modules/identity/sessions/presentation/http/decorators/request-source.decorator";
import { RegisterUseCase } from "#api/modules/identity/users/application/use-cases/register.use-case";
import { toRegisterResponse } from "#api/modules/identity/users/presentation/http/v1/user-account-response.mapper";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { ResponseLocale } from "#api/platform/http/decorators/locale.decorator";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import { ApiErrorResponse } from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiCreatedSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";
import { RateLimit } from "#api/platform/throttle/rate-limits";

import { MessageResponseDto } from "../../../../sessions/presentation/http/v1/login.dto.js";
import { toRequestMetadata } from "../../../../sessions/presentation/http/v1/request-metadata.mapper.js";
import { UserRateLimits } from "../users.rate-limits.js";
import { RegisterDto } from "./user-account.dto.js";

@ApiTags(SWAGGER_TAGS.USER_AUTH)
@Controller({ path: "auth", version: API_VERSION.V1 })
export class RegistrationController {
  readonly #registerUseCase: RegisterUseCase;

  constructor(registerUseCase: RegisterUseCase) {
    this.#registerUseCase = registerUseCase;
  }

  @Post("register")
  @Public()
  @RateLimit(UserRateLimits.register)
  @ApiDoc({
    summary: "회원가입",
    operationId: "register",
    description: `
## 📋 회원가입
이메일/비밀번호로 계정 생성 후 인증 코드가 발송됩니다.

### 📝 요청 Body
- \`email\`: 이메일 주소
- \`password\`: 비밀번호 (8자 이상, 영문+숫자)
- \`nickname\`: 닉네임
- \`termsAgreed\`: 이용약관 동의 (필수)
- \`privacyAgreed\`: 개인정보처리방침 동의 (필수)
- \`marketingAgreed\`: 마케팅 수신 동의 (선택)

### 🔄 다음 단계
\`POST /auth/verify-email\`로 인증 코드 확인 (10분 내)

### ⚠️ 에러 케이스
| 코드 | 상황 |
|------|------|
| EMAIL_0501 | 이미 가입된 이메일 |

### ⏱️ 제한사항
- IP당 분당 5회까지 호출할 수 있고, 넘으면 429(SYS_0001)입니다
		`,
  })
  @ApiCreatedSuccessResponse({ type: MessageResponseDto })
  @ApiErrorResponse({ errorCode: ErrorCode.EMAIL_0501 })
  async register(
    @Body({ schema: RegisterDto }) dto: RegisterDto,
    @CurrentRequestSource() source: RequestSource,
    @ResponseLocale() emailLocale: SupportedLocale,
  ) {
    const result = await this.#registerUseCase.execute({
      ...dto,
      metadata: toRequestMetadata(source),
      emailLocale,
    });
    return toRegisterResponse(result);
  }
}
