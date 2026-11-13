import { randomBytes } from "node:crypto";

import type { CurrentUserPayload } from "@aido/api/contracts/auth";
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
  Res,
} from "@nestjs/common";
import { ApiHeader, ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";

import { AuthLogEvent } from "#api/modules/identity/auth/application/auth.log-events";
import { CompleteOAuthAuthorizationUseCase } from "#api/modules/identity/auth/application/use-cases/complete-oauth-authorization.use-case";
import { ExchangeOAuthCodeUseCase } from "#api/modules/identity/auth/application/use-cases/exchange-oauth-code.use-case";
import { GetOAuthRedirectUriUseCase } from "#api/modules/identity/auth/application/use-cases/get-oauth-redirect-uri.use-case";
import { LinkOAuthAccountWithCodeUseCase } from "#api/modules/identity/auth/application/use-cases/link-oauth-account-with-code.use-case";
import { LinkOAuthAccountUseCase } from "#api/modules/identity/auth/application/use-cases/link-oauth-account.use-case";
import { LoginWithMobileOAuthTokenUseCase } from "#api/modules/identity/auth/application/use-cases/login-with-mobile-oauth-token.use-case";
import { StartOAuthAuthorizationUseCase } from "#api/modules/identity/auth/application/use-cases/start-oauth-authorization.use-case";
import { DEFAULT_OAUTH_REDIRECT_URI } from "#api/modules/identity/auth/domain/auth.constants";
import { CurrentUser } from "#api/modules/identity/auth/presentation/http/decorators/current-user.decorator";
import { Public } from "#api/modules/identity/auth/presentation/http/decorators/public.decorator";
import {
  CurrentRequestSource,
  type RequestSource,
} from "#api/modules/identity/auth/presentation/http/decorators/request-source.decorator";
import { AuthMapper } from "#api/modules/identity/auth/presentation/http/v1/auth-response.mapper";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { AppVersion } from "#api/platform/http/request-client/request-client.decorator";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiErrorCodesResponse,
  ApiErrorResponse,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";
import { ThrottleByUser } from "#api/platform/throttle/user-aware-throttler.guard";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";

import { invalidCredentials } from "../../../application/auth.errors.js";
import { buildOAuthErrorParams, toRequestMetadata } from "./auth-request.mapper.js";
import { AUTH_THROTTLE } from "./auth-throttle.constants.js";
import {
  AppleMobileCallbackDto,
  AuthTokensDto,
  ExchangeCodeDto,
  GoogleMobileCallbackDto,
  KakaoMobileCallbackDto,
  LinkSocialAccountDto,
  MessageResponseDto,
  NaverMobileCallbackDto,
  OAuthStartQueryDto,
  OAuthWebCallbackQueryDto,
} from "./auth.dto.js";

type WebOAuthProvider = Exclude<(typeof OAUTH_PROVIDERS)[number], "APPLE">;

const OAUTH_STATE_BYTES = 16;

@ApiTags(SWAGGER_TAGS.USER_AUTH)
@Controller({ path: "auth", version: API_VERSION.V1 })
export class OAuthController {
  readonly #logger = new Logger(OAuthController.name);

  readonly #getOAuthRedirectUriQuery: GetOAuthRedirectUriUseCase;
  readonly #startOAuthAuthorizationUseCase: StartOAuthAuthorizationUseCase;
  readonly #completeOAuthAuthorizationUseCase: CompleteOAuthAuthorizationUseCase;
  readonly #loginWithMobileOAuthTokenUseCase: LoginWithMobileOAuthTokenUseCase;
  readonly #linkOAuthAccountUseCase: LinkOAuthAccountUseCase;
  readonly #linkOAuthAccountWithCodeUseCase: LinkOAuthAccountWithCodeUseCase;
  readonly #exchangeOAuthCodeUseCase: ExchangeOAuthCodeUseCase;

  constructor(
    getOAuthRedirectUriQuery: GetOAuthRedirectUriUseCase,
    startOAuthAuthorizationUseCase: StartOAuthAuthorizationUseCase,
    completeOAuthAuthorizationUseCase: CompleteOAuthAuthorizationUseCase,
    loginWithMobileOAuthTokenUseCase: LoginWithMobileOAuthTokenUseCase,
    linkOAuthAccountUseCase: LinkOAuthAccountUseCase,
    linkOAuthAccountWithCodeUseCase: LinkOAuthAccountWithCodeUseCase,
    exchangeOAuthCodeUseCase: ExchangeOAuthCodeUseCase,
  ) {
    this.#getOAuthRedirectUriQuery = getOAuthRedirectUriQuery;
    this.#startOAuthAuthorizationUseCase = startOAuthAuthorizationUseCase;
    this.#completeOAuthAuthorizationUseCase = completeOAuthAuthorizationUseCase;
    this.#loginWithMobileOAuthTokenUseCase = loginWithMobileOAuthTokenUseCase;
    this.#linkOAuthAccountUseCase = linkOAuthAccountUseCase;
    this.#linkOAuthAccountWithCodeUseCase = linkOAuthAccountWithCodeUseCase;
    this.#exchangeOAuthCodeUseCase = exchangeOAuthCodeUseCase;
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
        event: AuthLogEvent.OAUTH_ERROR_REDIRECT_FAILED,
        errorType: toErrorType(error),
      });
      return DEFAULT_OAUTH_REDIRECT_URI;
    }
  }

  #logCallbackFailed(provider: WebOAuthProvider, error: unknown): void {
    if (error instanceof ErrorCodedException) {
      this.#logger.warn({
        event: AuthLogEvent.OAUTH_CALLBACK_FAILED,
        provider,
        errorType: error.name,
        errorCode: error.errorCode,
      });
      return;
    }
    this.#logger.error({
      event: AuthLogEvent.OAUTH_CALLBACK_FAILED,
      provider,
      errorType: toErrorType(error),
    });
  }

  @Post("exchange")
  @HttpCode(HttpStatus.OK)
  @Public()
  @Throttle({ default: AUTH_THROTTLE.OAUTH_CODE })
  @Header("Vary", "Origin, X-App-Version")
  @ApiHeader({
    name: "x-app-version",
    required: false,
    description: "설치된 앱 버전. 미전송 시 기존 프로필 아이콘으로 응답합니다.",
  })
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
    return AuthMapper.toExchangeCodeResponse(result, appVersion);
  }

  @Post("apple/callback")
  @HttpCode(HttpStatus.OK)
  @Public()
  @Throttle({ default: AUTH_THROTTLE.OAUTH_CODE })
  @Header("Vary", "Origin, X-App-Version")
  @ApiHeader({
    name: "x-app-version",
    required: false,
    description: "설치된 앱 버전. 미전송 시 기존 프로필 아이콘으로 응답합니다.",
  })
  @ApiDoc({
    summary: "Apple 로그인 (모바일 네이티브)",
    operationId: "appleCallback",
    description: `## 🍎 Apple 로그인 (모바일 네이티브)

\`expo-apple-authentication\`으로 Apple Sign In 후 Identity Token을 전송합니다.
시스템 인증 다이얼로그를 사용하므로 Redirect URI가 불필요합니다.

> 📖 상세 구현 가이드: \`apps/mobile/docs/auth.md\`

### 🔄 플로우
1. 클라이언트: \`AppleAuthentication.signInAsync()\` 호출
2. Apple 시스템: 사용자 인증 후 Identity Token 반환
3. 클라이언트: Identity Token을 이 엔드포인트로 전송
4. 백엔드: Token 검증 → 사용자 생성/업데이트 → JWT 발급

### 📝 요청 Body
| 필드 | 타입 | 필수 | 설명 |
|------|------|:----:|------|
| \`idToken\` | string | ✅ | Apple Identity Token (JWT) |
| \`userName\` | string | ❌ | 사용자 이름 (최초 로그인 시만 제공) |
| \`deviceName\` | string | ❌ | 디바이스 이름 |
| \`deviceType\` | string | ❌ | 디바이스 타입 |
| \`nonce\` | string | ❌ | CSRF 방지용 (선택) |

### ⚠️ 에러 케이스
| 코드 | HTTP | 상황 | 클라이언트 처리 |
|------|------|------|----------------|
| \`SOCIAL_0202\` | 401 | 유효하지 않은 토큰 | 재로그인 요청 |

### 🆕 신규 가입 여부
- 이 로그인에서 계정이 새로 만들어졌으면 응답의 \`isNewUser: true\`
- 기존 계정 로그인·이메일 자동 연결·탈퇴 유예 복구는 \`isNewUser: false\`

### 💡 참고
- Apple은 **최초 로그인 시에만** email/name을 제공합니다
- "Hide My Email" 선택 시 \`random@privaterelay.appleid.com\` 형식 제공`,
  })
  @ApiSuccessResponse({ type: AuthTokensDto })
  @ApiErrorResponse({ errorCode: ErrorCode.SOCIAL_0202 })
  async appleCallback(
    @Body({ schema: AppleMobileCallbackDto }) dto: AppleMobileCallbackDto,
    @CurrentRequestSource() source: RequestSource,
    @AppVersion() appVersion?: string,
  ) {
    const result = await this.#loginWithMobileOAuthTokenUseCase.execute({
      provider: "APPLE",
      token: dto.idToken,
      userName: dto.userName,
      metadata: toRequestMetadata(source, dto),
      nonce: dto.nonce,
    });

    return AuthMapper.toSocialAuthTokensResponse(result, appVersion);
  }

  @Post("google/callback")
  @HttpCode(HttpStatus.OK)
  @Public()
  @Throttle({ default: AUTH_THROTTLE.OAUTH_CODE })
  @Header("Vary", "Origin, X-App-Version")
  @ApiHeader({
    name: "x-app-version",
    required: false,
    description: "설치된 앱 버전. 미전송 시 기존 프로필 아이콘으로 응답합니다.",
  })
  @ApiDoc({
    summary: "Google 로그인 (모바일 네이티브)",
    operationId: "googleMobileCallback",
    description: `## 🔵 Google 로그인 (모바일 네이티브)

\`expo-auth-session\`의 Google OAuth 제공자를 통해 ID Token을 받은 후 백엔드로 전송합니다.
시스템 브라우저를 사용하여 보안 인증 UI를 제공합니다.

> 📖 상세 구현 가이드: \`apps/mobile/docs/auth.md\`

### 🔄 플로우
1. 클라이언트: \`Google.useAuthRequest()\`로 인증 요청
2. Google 서버: 시스템 브라우저 인증 후 ID Token 반환
3. 클라이언트: ID Token을 이 엔드포인트로 전송
4. 백엔드: JWT 서명 검증 → 사용자 조회/생성 → 토큰 발급

### 📝 요청 Body
| 필드 | 타입 | 필수 | 설명 |
|------|------|:----:|------|
| \`idToken\` | string | ✅ | Google ID Token (JWT) |
| \`userName\` | string | ❌ | 사용자 이름 (최초 로그인 시 권장) |
| \`deviceName\` | string | ❌ | 디바이스 이름 |
| \`deviceType\` | string | ❌ | 디바이스 유형 (iOS, Android) |

### ⚠️ 에러 케이스
| 코드 | HTTP | 상황 | 클라이언트 처리 |
|------|------|------|----------------|
| \`SOCIAL_0202\` | 401 | 유효하지 않은 토큰 | 재로그인 유도 |

### 💡 참고
- ID Token은 1시간 유효, 만료 후 재인증 필요
- 웹/iOS/Android별 Client ID가 다르므로 정확히 구분 필요`,
  })
  @ApiSuccessResponse({ type: AuthTokensDto })
  @ApiErrorResponse({ errorCode: ErrorCode.SOCIAL_0202 })
  async googleCallback(
    @Body({ schema: GoogleMobileCallbackDto }) dto: GoogleMobileCallbackDto,
    @CurrentRequestSource() source: RequestSource,
    @AppVersion() appVersion?: string,
  ) {
    const result = await this.#loginWithMobileOAuthTokenUseCase.execute({
      provider: "GOOGLE",
      token: dto.idToken,
      userName: dto.userName,
      metadata: toRequestMetadata(source, dto),
    });

    return AuthMapper.toSocialAuthTokensResponse(result, appVersion);
  }

  @Get("google/start")
  @Public()
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
    @Res() res: Response,
  ): Promise<void> {
    res.redirect(await this.#authorizationUrl("GOOGLE", query));
  }

  @Get("google/web-callback")
  @Public()
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
    @Res() res: Response,
  ): Promise<void> {
    res.redirect(await this.#webCallbackRedirectUrl("GOOGLE", query, source));
  }

  @Post("kakao/callback")
  @HttpCode(HttpStatus.OK)
  @Public()
  @Throttle({ default: AUTH_THROTTLE.OAUTH_CODE })
  @Header("Vary", "Origin, X-App-Version")
  @ApiHeader({
    name: "x-app-version",
    required: false,
    description: "설치된 앱 버전. 미전송 시 기존 프로필 아이콘으로 응답합니다.",
  })
  @ApiDoc({
    summary: "Kakao 로그인 (모바일 네이티브)",
    operationId: "kakaoMobileCallback",
    description: `
## 🟡 Kakao 로그인 (모바일 네이티브)

\`expo-auth-session\`을 사용하여 Kakao OAuth 인증 후 Access Token으로 사용자 정보를 조회하고 전송합니다.
서버는 Access Token으로 Kakao API를 직접 호출하여 프로필을 검증합니다.

> 📖 상세 구현 가이드: \`apps/mobile/docs/auth.md\`

### 🔄 플로우
1. 클라이언트: \`expo-auth-session\`으로 Authorization Code → Access Token 교환
2. 클라이언트: Kakao API(\`/v2/user/me\`)로 사용자 정보 조회
3. 클라이언트: 프로필 정보를 이 엔드포인트로 전송
4. 백엔드: Access Token으로 Kakao API 직접 호출하여 검증 → JWT 발급

### 📝 요청 Body
| 필드 | 타입 | 필수 | 설명 |
|------|------|:----:|------|
| \`profile.id\` | string | ✅ | Kakao 고유 사용자 ID (**문자열로 변환**) |
| \`profile.email\` | string | ❌ | 이메일 (사용자 동의 시에만) |
| \`profile.emailVerified\` | boolean | ❌ | 이메일 인증 여부 (기본: false) |
| \`profile.name\` | string | ❌ | 카카오 닉네임 |
| \`profile.picture\` | string | ❌ | 프로필 사진 URL |

### ⚠️ 에러 케이스
| 코드 | HTTP | 상황 | 클라이언트 처리 |
|------|------|------|----------------|
| \`SOCIAL_0202\` | 401 | 유효하지 않은 토큰 | 재로그인 유도 |

### 💡 참고
- Kakao API는 \`id\`를 숫자로 반환하지만, 백엔드에는 **문자열**로 전송 필수
- 이메일은 사용자가 동의해야만 제공됨

IP당 분당 10회까지 호출할 수 있고, 넘으면 429(SYS_0001)입니다.

IP당 분당 10회까지 호출할 수 있고, 넘으면 429(SYS_0001)입니다.

IP당 분당 10회까지 호출할 수 있고, 넘으면 429(SYS_0001)입니다.

IP당 분당 10회까지 호출할 수 있고, 넘으면 429(SYS_0001)입니다.
		`,
  })
  @ApiSuccessResponse({ type: AuthTokensDto })
  @ApiErrorResponse({ errorCode: ErrorCode.SOCIAL_0202 })
  async kakaoCallback(
    @Body({ schema: KakaoMobileCallbackDto }) dto: KakaoMobileCallbackDto,
    @CurrentRequestSource() source: RequestSource,
    @AppVersion() appVersion?: string,
  ) {
    const result = await this.#loginWithMobileOAuthTokenUseCase.execute({
      provider: "KAKAO",
      token: dto.accessToken,
      userName: dto.userName,
      metadata: toRequestMetadata(source, dto),
    });

    return AuthMapper.toSocialAuthTokensResponse(result, appVersion);
  }

  @Get("kakao/start")
  @Public()
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
    @Res() res: Response,
  ): Promise<void> {
    res.redirect(await this.#authorizationUrl("KAKAO", query));
  }

  @Get("kakao/web-callback")
  @Public()
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
    @Res() res: Response,
  ): Promise<void> {
    res.redirect(await this.#webCallbackRedirectUrl("KAKAO", query, source));
  }

  @Post("naver/callback")
  @HttpCode(HttpStatus.OK)
  @Public()
  @Throttle({ default: AUTH_THROTTLE.OAUTH_CODE })
  @Header("Vary", "Origin, X-App-Version")
  @ApiHeader({
    name: "x-app-version",
    required: false,
    description: "설치된 앱 버전. 미전송 시 기존 프로필 아이콘으로 응답합니다.",
  })
  @ApiDoc({
    summary: "Naver 로그인 (모바일 네이티브)",
    operationId: "naverMobileCallback",
    description: `
## 🟢 Naver 로그인 (모바일 네이티브)

\`expo-auth-session\`을 사용하여 Naver OAuth 인증 후 Access Token으로 사용자 정보를 조회하고 전송합니다.
서버는 Access Token으로 Naver API를 직접 호출하여 프로필을 검증합니다.

> 📖 상세 구현 가이드: \`apps/mobile/docs/auth.md\`

### 🔄 플로우
1. 클라이언트: \`expo-auth-session\`으로 Authorization Code 획득
2. 클라이언트: Access Token 교환 (**client_secret 필수** → 직접 호출)
3. 클라이언트: Naver API(\`/v1/nid/me\`)로 사용자 정보 조회 후 전송
4. 백엔드: Access Token으로 Naver API 직접 호출하여 검증 → JWT 발급

### 📝 요청 Body
| 필드 | 타입 | 필수 | 설명 |
|------|------|:----:|------|
| \`profile.id\` | string | ✅ | Naver 고유 사용자 ID |
| \`profile.email\` | string | ❌ | 이메일 주소 (사용자 동의 시) |
| \`profile.name\` | string | ❌ | 이름 또는 닉네임 |
| \`profile.picture\` | string | ❌ | 프로필 사진 URL |

### ⚠️ 에러 케이스
| 코드 | HTTP | 상황 | 클라이언트 처리 |
|------|------|------|----------------|
| \`SOCIAL_0202\` | 401 | 유효하지 않은 토큰 | 재로그인 유도 |

### 💡 참고
- Naver는 토큰 교환 시 **client_secret 필수** (Kakao/Google과 다름)
- client_secret을 앱에 직접 넣으면 보안 위험 → 프록시 서버 사용 권장
- 동의 항목을 사용자가 거부하면 해당 정보는 null 반환

IP당 분당 10회까지 호출할 수 있고, 넘으면 429(SYS_0001)입니다.
		`,
  })
  @ApiSuccessResponse({ type: AuthTokensDto })
  @ApiErrorResponse({ errorCode: ErrorCode.SOCIAL_0202 })
  async naverCallback(
    @Body({ schema: NaverMobileCallbackDto }) dto: NaverMobileCallbackDto,
    @CurrentRequestSource() source: RequestSource,
    @AppVersion() appVersion?: string,
  ) {
    const result = await this.#loginWithMobileOAuthTokenUseCase.execute({
      provider: "NAVER",
      token: dto.accessToken,
      userName: dto.userName,
      metadata: toRequestMetadata(source, dto),
    });

    return AuthMapper.toSocialAuthTokensResponse(result, appVersion);
  }

  @Get("naver/start")
  @Public()
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
    @Res() res: Response,
  ): Promise<void> {
    res.redirect(await this.#authorizationUrl("NAVER", query));
  }

  @Get("naver/web-callback")
  @Public()
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
    @Res() res: Response,
  ): Promise<void> {
    res.redirect(await this.#webCallbackRedirectUrl("NAVER", query, source));
  }

  @Post("link")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ThrottleByUser()
  @Throttle({ default: AUTH_THROTTLE.LINK_SOCIAL_ACCOUNT })
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

  @Post("link-with-code")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ThrottleByUser()
  @Throttle({ default: AUTH_THROTTLE.LINK_SOCIAL_ACCOUNT })
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
}
