import type { CurrentUserPayload } from "@aido/api/contracts/auth";
import { ErrorCode } from "@aido/api/errors";
import { Header, Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { LoginWithPasswordUseCase } from "#api/modules/identity/sessions/application/use-cases/login-with-password.use-case";
import { LogoutAllUseCase } from "#api/modules/identity/sessions/application/use-cases/logout-all.use-case";
import { LogoutUseCase } from "#api/modules/identity/sessions/application/use-cases/logout.use-case";
import { RefreshTokensUseCase } from "#api/modules/identity/sessions/application/use-cases/refresh-tokens.use-case";
import { VerifyEmailUseCase } from "#api/modules/identity/sessions/application/use-cases/verify-email.use-case";
import type { RefreshTokenUser } from "#api/modules/identity/sessions/presentation/http/decorators/authenticated-user.dto";
import { CurrentRefreshUser } from "#api/modules/identity/sessions/presentation/http/decorators/current-refresh-user.decorator";
import { CurrentUser } from "#api/modules/identity/sessions/presentation/http/decorators/current-user.decorator";
import { Public } from "#api/modules/identity/sessions/presentation/http/decorators/public.decorator";
import {
  CurrentRequestSource,
  type RequestSource,
} from "#api/modules/identity/sessions/presentation/http/decorators/request-source.decorator";
import { JwtRefreshGuard } from "#api/modules/identity/sessions/presentation/http/guards/jwt-refresh.guard";
import {
  toAuthTokensResponse,
  toMessageResponse,
  toRefreshTokensResponse,
} from "#api/modules/identity/sessions/presentation/http/v1/login-response.mapper";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { AppVersion } from "#api/platform/http/request-client/request-client.decorator";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiErrorCodesResponse,
  ApiErrorResponse,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiAppVersionHeader } from "#api/platform/http/swagger/decorators/api-header.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";
import { RateLimit } from "#api/platform/throttle/rate-limits";

import { SessionRateLimits } from "../sessions.rate-limits.js";
import {
  AuthTokensDto,
  LoginDto,
  MessageResponseDto,
  RefreshTokensDto,
  VerifyEmailDto,
} from "./login.dto.js";
import { toRequestMetadata } from "./request-metadata.mapper.js";

@ApiTags(SWAGGER_TAGS.USER_AUTH)
@Controller({ path: "auth", version: API_VERSION.V1 })
export class LoginController {
  readonly #verifyEmailUseCase: VerifyEmailUseCase;
  readonly #loginWithPasswordUseCase: LoginWithPasswordUseCase;
  readonly #logoutUseCase: LogoutUseCase;
  readonly #logoutAllUseCase: LogoutAllUseCase;
  readonly #refreshTokensUseCase: RefreshTokensUseCase;

  constructor(
    verifyEmailUseCase: VerifyEmailUseCase,
    loginWithPasswordUseCase: LoginWithPasswordUseCase,
    logoutUseCase: LogoutUseCase,
    logoutAllUseCase: LogoutAllUseCase,
    refreshTokensUseCase: RefreshTokensUseCase,
  ) {
    this.#verifyEmailUseCase = verifyEmailUseCase;
    this.#loginWithPasswordUseCase = loginWithPasswordUseCase;
    this.#logoutUseCase = logoutUseCase;
    this.#logoutAllUseCase = logoutAllUseCase;
    this.#refreshTokensUseCase = refreshTokensUseCase;
  }

  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  @Public()
  @RateLimit(SessionRateLimits.verifyEmail)
  @Header("Vary", "Origin, X-App-Version")
  @ApiAppVersionHeader()
  @ApiDoc({
    summary: "이메일 인증 코드 확인",
    operationId: "verifyEmail",
    description: `
## ✉️ 이메일 인증
회원가입 시 발송된 6자리 인증 코드를 검증합니다. 성공 시 토큰이 발급됩니다.

### 📝 요청 Body
- \`email\`: 가입한 이메일 주소
- \`code\`: 6자리 인증 코드

### 🎫 응답 토큰
| 토큰 | 유효기간 |
|------|----------|
| accessToken | 15분 |
| refreshToken | 7일 |

### ⚠️ 에러 케이스
| 코드 | 상태 | 상황 |
|------|------|------|
| EMAIL_0502 | 404 | 가입하지 않은 이메일 |
| VERIFY_0751 | 401 | 인증 코드가 틀렸거나 만료·사용된 코드 |
| VERIFY_0754 | 429 | 인증 시도 5회 초과. 새 코드를 요청해야 합니다 |
| USER_0604 | 409 | 이미 인증 완료된 사용자 |

### ⏱️ 제한사항
- IP당 분당 10회까지 호출할 수 있고, 넘으면 429(SYS_0001)입니다
		`,
  })
  @ApiSuccessResponse({ type: AuthTokensDto })
  @ApiErrorResponse({ errorCode: ErrorCode.EMAIL_0502 })
  @ApiErrorCodesResponse(HttpStatus.UNAUTHORIZED, [ErrorCode.EMAIL_0504, ErrorCode.EMAIL_0505])
  @ApiErrorResponse({ errorCode: ErrorCode.USER_0604 })
  async verifyEmail(
    @Body({ schema: VerifyEmailDto }) dto: VerifyEmailDto,
    @CurrentRequestSource() source: RequestSource,
    @AppVersion() appVersion?: string,
  ) {
    const metadata = toRequestMetadata(source);
    const result = await this.#verifyEmailUseCase.execute({ ...dto, metadata });
    return toAuthTokensResponse(result, appVersion);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Public()
  @RateLimit(SessionRateLimits.login)
  @Header("Vary", "Origin, X-App-Version")
  @ApiAppVersionHeader()
  @ApiDoc({
    summary: "이메일 로그인",
    operationId: "login",
    description: `
## 🔑 로그인
이메일/비밀번호로 로그인 후 토큰을 발급받습니다.

### 📝 요청 Body
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| \`email\` | string | ✅ | 이메일 주소 |
| \`password\` | string | ✅ | 비밀번호 |
| \`deviceName\` | string | ❌ | 기기 이름 (선택, 세션 구분용, 예: iPhone 15 Pro) |
| \`deviceType\` | enum | ❌ | 디바이스 타입 (IOS, ANDROID, WEB) |

### 🎫 응답 토큰
| 토큰 | 유효기간 | 저장 위치 |
|------|----------|-----------|
| Access Token | 15분 | 메모리 |
| Refresh Token | 7일 | Secure Storage |

### ⚠️ 에러 케이스
| 코드 | 상태 | 상황 | 클라이언트 처리 |
|------|------|------|----------------|
| USER_0602 | 401 | 이메일/비밀번호 불일치 | 재입력 요청 |
| USER_0605 | 403 | 정지된 계정 | 고객센터 안내 |
| USER_0607 | 423 | 계정 잠금 (5회 실패) | 15분 대기 안내 |
| USER_0608 | 401 | 이메일 미인증 | 인증 화면 이동 + resend-verification 호출 |

IP당 분당 10회까지 호출할 수 있고, 넘으면 429(SYS_0001)입니다.

### 🔄 탈퇴 유예 계정 복구
탈퇴 후 **30일 이내**에 동일 이메일로 로그인하면 자동 복구됩니다.
- 응답의 \`accountRestored: true\`로 복구 여부 확인
- 클라이언트는 이 플래그를 확인하여 "계정이 복구되었습니다" 안내 표시
- 30일 경과 후에는 복구 불가 (USER_0606 에러)
		`,
  })
  @ApiSuccessResponse({ type: AuthTokensDto })
  @ApiErrorCodesResponse(HttpStatus.UNAUTHORIZED, [ErrorCode.USER_0602, ErrorCode.USER_0608])
  @ApiErrorResponse({ errorCode: ErrorCode.USER_0605 })
  @ApiErrorResponse({ errorCode: ErrorCode.USER_0606 })
  @ApiErrorResponse({ errorCode: ErrorCode.USER_0607 })
  async login(
    @Body({ schema: LoginDto }) dto: LoginDto,
    @CurrentRequestSource() source: RequestSource,
    @AppVersion() appVersion?: string,
  ) {
    const metadata = toRequestMetadata(source);
    const result = await this.#loginWithPasswordUseCase.execute({ ...dto, metadata });
    return toAuthTokensResponse(result, appVersion);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiDoc({
    summary: "로그아웃 (현재 기기)",
    operationId: "logout",
    description: `
## 🚪 로그아웃

현재 세션을 종료합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📋 동작
- 현재 세션만 종료됩니다
- 다른 기기의 세션은 유지됩니다
- 해당 Refresh Token도 무효화됩니다

### 💡 전체 로그아웃
모든 기기에서 로그아웃하려면:
\`POST /auth/logout-all\` 사용
		`,
  })
  @ApiSuccessResponse({ type: MessageResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async logout(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentRequestSource() source: RequestSource,
  ) {
    const metadata = toRequestMetadata(source);
    await this.#logoutUseCase.execute({ userId: user.userId, sessionId: user.sessionId, metadata });
    return toMessageResponse("로그아웃되었습니다.");
  }

  @Post("logout-all")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiDoc({
    summary: "전체 로그아웃 (모든 기기)",
    operationId: "logoutAll",
    description: `
## 🚪 전체 로그아웃

모든 기기의 세션을 한 번에 종료합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📋 동작
- 현재 기기 포함 **모든 세션**이 종료됩니다
- 모든 Refresh Token이 무효화됩니다
- 다른 기기에서 즉시 로그아웃됩니다

### 💡 사용 케이스
- 계정 보안 의심 시
- 기기 분실 시
- 비밀번호 변경 후 전체 재로그인 유도 시
		`,
  })
  @ApiSuccessResponse({ type: MessageResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async logoutAll(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentRequestSource() source: RequestSource,
  ) {
    await this.#logoutAllUseCase.execute({
      userId: user.userId,
      metadata: toRequestMetadata(source),
    });
    return toMessageResponse("모든 기기에서 로그아웃되었습니다.");
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @Public()
  @UseGuards(JwtRefreshGuard)
  @ApiBearerAuth()
  @RateLimit(SessionRateLimits.refresh)
  @ApiDoc({
    summary: "토큰 갱신",
    operationId: "refreshTokens",
    description: `
## 🔄 토큰 갱신
Refresh Token으로 새 토큰 쌍을 발급받습니다. (Token Rotation 적용)

### 🔐 인증
\`Authorization: Bearer {refreshToken}\` (**Access Token 아님!**)

### 📋 동작
- 새 Access + Refresh Token 발급
- 기존 Refresh Token 즉시 무효화

### ⚠️ 에러 케이스
| 코드 | 상황 | 클라이언트 처리 |
|------|------|----------------|
| AUTH_0104 | 유효하지 않은 토큰 | 재로그인 |
| SESSION_0704 | 토큰 재사용 감지 | 전체 세션 무효화, 재로그인 |

IP당 분당 20회까지 호출할 수 있고, 넘으면 429(SYS_0001)입니다.
		`,
  })
  @ApiSuccessResponse({ type: RefreshTokensDto })
  @ApiErrorCodesResponse(HttpStatus.UNAUTHORIZED, [ErrorCode.AUTH_0104, ErrorCode.SESSION_0704])
  async refresh(
    @CurrentRefreshUser() payload: RefreshTokenUser,
    @CurrentRequestSource() source: RequestSource,
  ) {
    const result = await this.#refreshTokensUseCase.execute({
      refreshToken: payload.refreshToken,
      verifiedPayload: {
        userId: payload.userId,
        email: payload.email,
        sessionId: payload.sessionId,
        role: payload.role,
      },
      metadata: toRequestMetadata(source),
    });
    return toRefreshTokensResponse(result);
  }
}
