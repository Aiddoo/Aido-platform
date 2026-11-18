import { randomBytes } from "node:crypto";

import type { CurrentUserPayload } from "@aido/api/contracts/auth/v1";
import { ErrorCode } from "@aido/api/errors";
import type { OAUTH_PROVIDERS } from "@aido/api/vocabulary";
import {
  Header,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { OAuthStateLogEvent } from "#api/modules/identity/oauth-states/application/oauth-states.log-events";
import { CompleteOAuthAuthorizationUseCase } from "#api/modules/identity/oauth-states/application/use-cases/complete-oauth-authorization.use-case";
import { ExchangeOAuthCodeUseCase } from "#api/modules/identity/oauth-states/application/use-cases/exchange-oauth-code.use-case";
import { GetOAuthRedirectUriUseCase } from "#api/modules/identity/oauth-states/application/use-cases/get-oauth-redirect-uri.use-case";
import { LinkOAuthAccountWithCodeUseCase } from "#api/modules/identity/oauth-states/application/use-cases/link-oauth-account-with-code.use-case";
import { StartOAuthAuthorizationUseCase } from "#api/modules/identity/oauth-states/application/use-cases/start-oauth-authorization.use-case";
import { DEFAULT_OAUTH_REDIRECT_URI } from "#api/modules/identity/oauth-states/domain/oauth-states.constants";
import { toExchangeCodeResponse } from "#api/modules/identity/oauth-states/presentation/http/v1/oauth-response.mapper";
import { CurrentUser } from "#api/modules/identity/sessions/presentation/http/decorators/current-user.decorator";
import { Public } from "#api/modules/identity/sessions/presentation/http/decorators/public.decorator";
import {
  CurrentRequestSource,
  type RequestSource,
} from "#api/modules/identity/sessions/presentation/http/decorators/request-source.decorator";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { RedirectResponse } from "#api/platform/http/decorators/redirect-response.decorator";
import { AppVersion } from "#api/platform/http/request-client/request-client.decorator";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiErrorCodesResponse,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiAppVersionHeader } from "#api/platform/http/swagger/decorators/api-header.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";
import { RateLimit } from "#api/platform/throttle/rate-limits";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";

import {
  AuthTokensDto,
  MessageResponseDto,
} from "../../../../sessions/presentation/http/v1/login.dto.js";
import {
  buildOAuthErrorParams,
  toRequestMetadata,
} from "../../../../sessions/presentation/http/v1/request-metadata.mapper.js";
import { invalidCredentials } from "../../../../users/application/users.errors.js";
import { OAuthStateRateLimits } from "../oauth-states.rate-limits.js";
import { ExchangeCodeDto, OAuthStartQueryDto, OAuthWebCallbackQueryDto } from "./oauth.dto.js";

type WebOAuthProvider = Exclude<(typeof OAUTH_PROVIDERS)[number], "APPLE">;

const OAUTH_STATE_BYTES = 16;

@ApiTags(SWAGGER_TAGS.USER_AUTH)
@Controller({ path: "auth", version: API_VERSION.V1 })
export class OAuthController {
  readonly #logger = new Logger(OAuthController.name);

  readonly #getOAuthRedirectUriQuery: GetOAuthRedirectUriUseCase;
  readonly #startOAuthAuthorizationUseCase: StartOAuthAuthorizationUseCase;
  readonly #completeOAuthAuthorizationUseCase: CompleteOAuthAuthorizationUseCase;
  readonly #linkOAuthAccountWithCodeUseCase: LinkOAuthAccountWithCodeUseCase;
  readonly #exchangeOAuthCodeUseCase: ExchangeOAuthCodeUseCase;

  constructor(
    getOAuthRedirectUriQuery: GetOAuthRedirectUriUseCase,
    startOAuthAuthorizationUseCase: StartOAuthAuthorizationUseCase,
    completeOAuthAuthorizationUseCase: CompleteOAuthAuthorizationUseCase,
    linkOAuthAccountWithCodeUseCase: LinkOAuthAccountWithCodeUseCase,
    exchangeOAuthCodeUseCase: ExchangeOAuthCodeUseCase,
  ) {
    this.#getOAuthRedirectUriQuery = getOAuthRedirectUriQuery;
    this.#startOAuthAuthorizationUseCase = startOAuthAuthorizationUseCase;
    this.#completeOAuthAuthorizationUseCase = completeOAuthAuthorizationUseCase;
    this.#linkOAuthAccountWithCodeUseCase = linkOAuthAccountWithCodeUseCase;
    this.#exchangeOAuthCodeUseCase = exchangeOAuthCodeUseCase;
  }

  @Post("exchange")
  @HttpCode(HttpStatus.OK)
  @Public()
  @RateLimit(OAuthStateRateLimits.exchangeOAuthCode)
  @Header("Vary", "Origin, X-App-Version")
  @ApiAppVersionHeader()
  @ApiDoc({
    summary: "교환 코드로 토큰 획득",
    operationId: "exchangeOAuthCode",
    description: `OAuth Web 콜백에서 발급된 **일회용 교환 코드**를 JWT 토큰으로 교환합니다.

딥링크(\`aido://auth/callback?code=xxx&state=xxx\`)에서 받은 code를 전송하세요.

📝 **요청 Body**
| 필드 | 타입 | 필수 | 설명 |
|------|------|:----:|------|
| \`code\` | string | ✅ | 일회용 교환 코드 (10분 내 사용) |

⚠️ **에러 케이스**
| 코드 | 상황 |
|------|------|
| \`AUTH_0107\` | 유효하지 않거나 만료/사용된 교환 코드 |

### 🔄 탈퇴 유예 계정 복구
탈퇴 후 **30일 이내**에 동일 소셜 계정으로 로그인하면 자동 복구됩니다.
- 응답의 \`accountRestored: true\`로 복구 여부 확인
- 클라이언트는 이 플래그를 확인하여 "계정이 복구되었습니다" 안내 표시

### 🆕 신규 가입 여부
- 이 로그인에서 계정이 새로 만들어졌으면 \`isNewUser: true\`
- 기존 계정 로그인·이메일 자동 연결·탈퇴 유예 복구는 \`isNewUser: false\``,
  })
  @ApiSuccessResponse({
    description: "토큰 교환 성공",
    type: AuthTokensDto,
  })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async exchangeCode(
    @Body({ schema: ExchangeCodeDto }) dto: ExchangeCodeDto,
    @CurrentRequestSource() source: RequestSource,
    @AppVersion() appVersion?: string,
  ): Promise<AuthTokensDto> {
    const result = await this.#exchangeOAuthCodeUseCase.execute({
      code: dto.code,
      device: toRequestMetadata(source).device,
    });
    return toExchangeCodeResponse(result, appVersion);
  }

  @Get("google/start")
  @Public()
  @RedirectResponse()
  @ApiDoc({
    summary: "Google OAuth 시작 (웹 브라우저)",
    operationId: "googleOAuthStart",
    description: `\`expo-web-browser\`로 브라우저를 열어 구글 로그인 페이지로 리다이렉트합니다.

🔄 **플로우**: \`GET /google/start\` → 구글 로그인 → \`GET /google/web-callback\` → \`{redirect_uri}?code=xxx&state=xxx\`

✅ **허용 URI**: \`aido://auth/callback\`, \`https://aido.kr/*\`, \`http://localhost:*/*\`

### 📝 mode 파라미터
- \`login\` (기본값): 소셜 로그인 → \`POST /auth/exchange\` 로 토큰 교환
- \`link\`: 소셜 계정 연동 → \`POST /auth/link-with-code\` 로 연동 완료`,
  })
  async googleOAuthStart(
    @Query({ schema: OAuthStartQueryDto }) query: OAuthStartQueryDto,
  ): Promise<{ url: string }> {
    return { url: await this.#authorizationUrl("GOOGLE", query) };
  }

  @Get("google/web-callback")
  @Public()
  @RedirectResponse()
  @ApiDoc({
    summary: "Google OAuth 콜백 (웹 브라우저)",
    operationId: "googleOAuthCallback",
    description: `구글 인증 완료 후 authorization code를 처리하고 일회용 교환 코드를 발급합니다.

🔄 **플로우**: \`GET /google/web-callback\` → 교환 코드 발급 → \`{redirect_uri}?code=xxx&state=xxx\` → \`POST /auth/exchange\`

⚠️ **에러 시**: \`{redirect_uri}?error=authentication_failed&error_description=...&state=xxx\`

💡 **참고**: 콜백 URL의 \`code\`는 일회용 교환 코드입니다. \`POST /auth/exchange\`로 토큰을 획득하세요.`,
  })
  async googleOAuthCallback(
    @Query({ schema: OAuthWebCallbackQueryDto }) query: OAuthWebCallbackQueryDto,
    @CurrentRequestSource() source: RequestSource,
  ): Promise<{ url: string }> {
    return { url: await this.#webCallbackRedirectUrl("GOOGLE", query, source) };
  }

  @Get("kakao/start")
  @Public()
  @RedirectResponse()
  @ApiDoc({
    summary: "Kakao OAuth 시작 (웹 브라우저)",
    operationId: "kakaoOAuthStart",
    description: `\`expo-web-browser\`로 브라우저를 열어 카카오 로그인 페이지로 리다이렉트합니다.

🔄 **플로우**: \`GET /kakao/start\` → 카카오 로그인 → \`GET /kakao/web-callback\` → \`{redirect_uri}?code=xxx&state=xxx\`

✅ **허용 URI**: \`aido://auth/callback\`, \`https://aido.kr/*\`, \`http://localhost:*/*\`

### 📝 mode 파라미터
- \`login\` (기본값): 소셜 로그인 → \`POST /auth/exchange\` 로 토큰 교환
- \`link\`: 소셜 계정 연동 → \`POST /auth/link-with-code\` 로 연동 완료`,
  })
  async kakaoOAuthStart(
    @Query({ schema: OAuthStartQueryDto }) query: OAuthStartQueryDto,
  ): Promise<{ url: string }> {
    return { url: await this.#authorizationUrl("KAKAO", query) };
  }

  @Get("kakao/web-callback")
  @Public()
  @RedirectResponse()
  @ApiDoc({
    summary: "Kakao OAuth 콜백 (웹 브라우저)",
    operationId: "kakaoOAuthCallback",
    description: `카카오 인증 완료 후 authorization code를 처리하고 일회용 교환 코드를 발급합니다.

🔄 **플로우**: \`GET /kakao/web-callback\` → 교환 코드 발급 → \`{redirect_uri}?code=xxx&state=xxx\` → \`POST /auth/exchange\`

⚠️ **에러 시**: \`{redirect_uri}?error=authentication_failed&error_description=...&state=xxx\`

💡 **참고**: 콜백 URL의 \`code\`는 일회용 교환 코드입니다. \`POST /auth/exchange\`로 토큰을 획득하세요.`,
  })
  async kakaoOAuthCallback(
    @Query({ schema: OAuthWebCallbackQueryDto }) query: OAuthWebCallbackQueryDto,
    @CurrentRequestSource() source: RequestSource,
  ): Promise<{ url: string }> {
    return { url: await this.#webCallbackRedirectUrl("KAKAO", query, source) };
  }

  @Get("naver/start")
  @Public()
  @RedirectResponse()
  @ApiDoc({
    summary: "Naver OAuth 시작 (웹 브라우저)",
    operationId: "naverOAuthStart",
    description: `\`expo-web-browser\`로 브라우저를 열어 네이버 로그인 페이지로 리다이렉트합니다.

🔄 **플로우**: \`GET /naver/start\` → 네이버 로그인 → \`GET /naver/web-callback\` → \`{redirect_uri}?code=xxx&state=xxx\`

✅ **허용 URI**: \`aido://auth/callback\`, \`https://aido.kr/*\`, \`http://localhost:*/*\`

### 📝 mode 파라미터
- \`login\` (기본값): 소셜 로그인 → \`POST /auth/exchange\` 로 토큰 교환
- \`link\`: 소셜 계정 연동 → \`POST /auth/link-with-code\` 로 연동 완료`,
  })
  async naverOAuthStart(
    @Query({ schema: OAuthStartQueryDto }) query: OAuthStartQueryDto,
  ): Promise<{ url: string }> {
    return { url: await this.#authorizationUrl("NAVER", query) };
  }

  @Get("naver/web-callback")
  @Public()
  @RedirectResponse()
  @ApiDoc({
    summary: "Naver OAuth 콜백 (웹 브라우저)",
    operationId: "naverOAuthCallback",
    description: `네이버 인증 완료 후 authorization code를 처리하고 일회용 교환 코드를 발급합니다.

🔄 **플로우**: \`GET /naver/web-callback\` → 교환 코드 발급 → \`{redirect_uri}?code=xxx&state=xxx\` → \`POST /auth/exchange\`

⚠️ **에러 시**: \`{redirect_uri}?error=authentication_failed&error_description=...&state=xxx\`

💡 **참고**: 콜백 URL의 \`code\`는 일회용 교환 코드입니다. \`POST /auth/exchange\`로 토큰을 획득하세요.`,
  })
  async naverOAuthCallback(
    @Query({ schema: OAuthWebCallbackQueryDto }) query: OAuthWebCallbackQueryDto,
    @CurrentRequestSource() source: RequestSource,
  ): Promise<{ url: string }> {
    return { url: await this.#webCallbackRedirectUrl("NAVER", query, source) };
  }

  @Post("link-with-code")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @RateLimit(OAuthStateRateLimits.linkWithExchangeCode)
  @ApiDoc({
    summary: "소셜 계정 연동 (교환 코드)",
    operationId: "linkWithExchangeCode",
    description: `
## 🔗 교환 코드 기반 소셜 계정 연동

웹 브라우저 OAuth 플로우(\`/auth/{provider}/start?mode=link\`)로 발급된 **교환 코드**를 사용하여
로그인된 사용자 계정에 소셜 계정을 연동합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 플로우
1. \`GET /auth/{provider}/start?mode=link&state=xxx&redirect_uri=aido://auth/callback\` 으로 OAuth 시작
2. 사용자가 소셜 계정 인증 완료
3. \`{redirect_uri}?code=xxx&state=xxx\` 로 리다이렉트 (교환 코드 발급)
4. 이 엔드포인트로 교환 코드 전송 → 계정 연동 완료

### 📝 요청 Body
| 필드 | 타입 | 필수 | 설명 |
|------|------|:----:|------|
| \`code\` | string | ✅ | 일회용 교환 코드 (10분 내 사용) |

### ⚠️ 제한사항
- 교환 코드는 \`mode=link\`로 시작된 OAuth 플로우에서 발급된 것이어야 합니다
- 이미 다른 사용자에 연결된 소셜 계정은 연동할 수 없습니다 (409)
- 교환 코드는 1회만 사용 가능합니다

### ⚠️ 에러 코드
| 코드 | HTTP | 설명 |
|------|------|------|
| \`AUTH_0107\` | 401 | 인증이 필요합니다 |
| \`SOCIAL_0202\` | 401 | 유효하지 않거나 만료/사용된 교환 코드 |
| \`KAKAO_0306\` | 409 | 이미 다른 계정에 연동된 카카오 계정 |
| \`APPLE_0355\` | 409 | 이미 다른 계정에 연동된 애플 계정 |
| \`GOOGLE_0405\` | 409 | 이미 다른 계정에 연동된 구글 계정 |
| \`NAVER_0455\` | 409 | 이미 다른 계정에 연동된 네이버 계정 |

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
  async linkWithExchangeCode(
    @CurrentUser() user: CurrentUserPayload,
    @Body({ schema: ExchangeCodeDto }) dto: ExchangeCodeDto,
    @CurrentRequestSource() source: RequestSource,
  ) {
    const metadata = toRequestMetadata(source);
    return this.#linkOAuthAccountWithCodeUseCase.execute({
      userId: user.userId,
      code: dto.code,
      metadata,
    });
  }

  #authorizationUrl(provider: WebOAuthProvider, query: OAuthStartQueryDto): Promise<string> {
    return this.#startOAuthAuthorizationUseCase.execute({
      provider,
      // 빈 state도 보내지 않은 것으로 보고 새로 만든다
      state: query.state || randomBytes(OAUTH_STATE_BYTES).toString("hex"),
      clientRedirectUri: query.redirect_uri,
      mode: query.mode,
      initiatingUserId: query.user_hint,
    });
  }

  /** 성공과 실패 모두 앱 딥링크로 돌려보낸다. 브라우저에 오류 응답을 띄우지 않는다 */
  async #webCallbackRedirectUrl(
    provider: WebOAuthProvider,
    { code, state = "" }: OAuthWebCallbackQueryDto,
    source: RequestSource,
  ): Promise<string> {
    try {
      // 공급자 화면에서 취소하면 code 없이 온다. 교환을 묻지 않고 교환 실패와 같은 코드로 돌려보낸다
      if (code == null) {
        throw invalidCredentials();
      }
      const result = await this.#completeOAuthAuthorizationUseCase.execute({
        provider,
        code,
        state,
        metadata: toRequestMetadata(source),
      });
      const params = new URLSearchParams({ code: result.exchangeCode, state });
      return `${result.redirectUri}?${params.toString()}`;
    } catch (error) {
      this.#logCallbackFailed(provider, error);
      const redirectUri = await this.#resolveOAuthErrorRedirectUri(state);
      return `${redirectUri}?${buildOAuthErrorParams(error, state).toString()}`;
    }
  }

  async #resolveOAuthErrorRedirectUri(state: string): Promise<string> {
    try {
      const redirectUri = await this.#getOAuthRedirectUriQuery.execute({ state });
      return redirectUri || DEFAULT_OAUTH_REDIRECT_URI;
    } catch (error) {
      this.#logger.warn({
        event: OAuthStateLogEvent.OAUTH_ERROR_REDIRECT_FAILED,
        errorType: toErrorType(error),
      });
      return DEFAULT_OAUTH_REDIRECT_URI;
    }
  }

  #logCallbackFailed(provider: WebOAuthProvider, error: unknown): void {
    if (error instanceof ErrorCodedException) {
      this.#logger.warn({
        event: OAuthStateLogEvent.OAUTH_CALLBACK_FAILED,
        provider,
        errorType: error.name,
        errorCode: error.errorCode,
      });
      return;
    }
    this.#logger.error({
      event: OAuthStateLogEvent.OAUTH_CALLBACK_FAILED,
      provider,
      errorType: toErrorType(error),
    });
  }
}
