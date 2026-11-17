import type { CurrentUserPayload } from "@aido/api/contracts/auth";
import { ErrorCode } from "@aido/api/errors";
import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { LinkOAuthAccountUseCase } from "#api/modules/identity/linked-accounts/application/use-cases/link-oauth-account.use-case";
import { CurrentUser } from "#api/modules/identity/sessions/presentation/http/decorators/current-user.decorator";
import {
  CurrentRequestSource,
  type RequestSource,
} from "#api/modules/identity/sessions/presentation/http/decorators/request-source.decorator";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import { ApiErrorCodesResponse } from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";
import { RateLimit } from "#api/platform/throttle/rate-limits";

import { MessageResponseDto } from "../../../../sessions/presentation/http/v1/login.dto.js";
import { toRequestMetadata } from "../../../../sessions/presentation/http/v1/request-metadata.mapper.js";
import { LinkedAccountsRateLimits } from "../linked-accounts.rate-limits.js";
import { LinkSocialAccountDto } from "./linked-account.dto.js";

@ApiTags(SWAGGER_TAGS.USER_AUTH)
@Controller({ path: "auth", version: API_VERSION.V1 })
export class SocialAccountLinkController {
  readonly #linkOAuthAccountUseCase: LinkOAuthAccountUseCase;

  constructor(linkOAuthAccountUseCase: LinkOAuthAccountUseCase) {
    this.#linkOAuthAccountUseCase = linkOAuthAccountUseCase;
  }

  @Post("link")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @RateLimit(LinkedAccountsRateLimits.linkSocialAccount)
  @ApiDoc({
    summary: "소셜 계정 연동 (토큰 직접 전송)",
    operationId: "linkSocialAccount",
    description: `
## 🔗 소셜 계정 연동

로그인된 사용자 계정에 소셜 계정을 추가로 연동합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 요청 방법
provider에 따라 필수 토큰이 다릅니다:
- **Apple/Google**: \`idToken\` 필수
- **Kakao/Naver**: \`accessToken\` 필수

### 📝 요청 예시

**Apple/Google (idToken)**
\`\`\`json
{ "provider": "GOOGLE", "idToken": "eyJhbGciOiJSUzI1NiIs..." }
\`\`\`

**Kakao/Naver (accessToken)**
\`\`\`json
{ "provider": "KAKAO", "accessToken": "aaaabbbbccccdddd..." }
\`\`\`

### ⚠️ 주의사항
- 이미 다른 사용자에 연결된 소셜 계정은 연동할 수 없습니다 (409)
- 동일한 소셜 계정을 중복 연동하면 "이미 연결된 계정입니다" 메시지를 반환합니다

### ⚠️ 에러 코드
| 코드 | HTTP | 설명 |
|------|------|------|
| \`AUTH_0107\` | 401 | 인증이 필요합니다 |
| \`SOCIAL_0202\` | 401 | 소셜 인증 토큰이 유효하지 않습니다 |
| \`KAKAO_0306\` | 409 | 이미 다른 계정에 연동된 카카오 계정 |
| \`APPLE_0355\` | 409 | 이미 다른 계정에 연동된 애플 계정 |
| \`GOOGLE_0405\` | 409 | 이미 다른 계정에 연동된 구글 계정 |
| \`NAVER_0455\` | 409 | 이미 다른 계정에 연동된 네이버 계정 |

### 💡 교환 코드 방식
웹 브라우저 OAuth 플로우를 사용하는 경우 \`POST /auth/link-with-code\` 엔드포인트를 사용하세요.

사용자마다 분당 10회까지 호출할 수 있고, 넘으면 429(SYS_0001)입니다.
		`,
  })
  @ApiSuccessResponse({ type: MessageResponseDto })
  @ApiErrorCodesResponse(HttpStatus.UNAUTHORIZED, [ErrorCode.AUTH_0107, ErrorCode.SOCIAL_0202])
  @ApiErrorCodesResponse(HttpStatus.CONFLICT, [
    ErrorCode.KAKAO_0306,
    ErrorCode.APPLE_0355,
    ErrorCode.GOOGLE_0405,
    ErrorCode.NAVER_0455,
  ])
  async linkSocialAccount(
    @CurrentUser() user: CurrentUserPayload,
    @Body({ schema: LinkSocialAccountDto }) dto: LinkSocialAccountDto,
    @CurrentRequestSource() source: RequestSource,
  ) {
    const metadata = toRequestMetadata(source);
    return this.#linkOAuthAccountUseCase.execute({ ...dto, userId: user.userId, metadata });
  }
}
