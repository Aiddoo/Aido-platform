import { ErrorCode } from "@aido/api/errors";
import { Header, Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { LoginWithMobileOAuthTokenUseCase } from "#api/modules/identity/sessions/application/use-cases/login-with-mobile-oauth-token.use-case";
import { Public } from "#api/modules/identity/sessions/presentation/http/decorators/public.decorator";
import {
  CurrentRequestSource,
  type RequestSource,
} from "#api/modules/identity/sessions/presentation/http/decorators/request-source.decorator";
import { toSocialAuthTokensResponse } from "#api/modules/identity/sessions/presentation/http/v1/login-response.mapper";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { AppVersion } from "#api/platform/http/request-client/request-client.decorator";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import { ApiErrorResponse } from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiAppVersionHeader } from "#api/platform/http/swagger/decorators/api-header.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";
import { RateLimit } from "#api/platform/throttle/rate-limits";

import { SessionRateLimits } from "../sessions.rate-limits.js";
import {
  AppleMobileCallbackDto,
  AuthTokensDto,
  GoogleMobileCallbackDto,
  KakaoMobileCallbackDto,
  NaverMobileCallbackDto,
} from "./login.dto.js";
import { toRequestMetadata } from "./request-metadata.mapper.js";

@ApiTags(SWAGGER_TAGS.USER_AUTH)
@Controller({ path: "auth", version: API_VERSION.V1 })
export class MobileOAuthLoginController {
  readonly #loginWithMobileOAuthTokenUseCase: LoginWithMobileOAuthTokenUseCase;

  constructor(loginWithMobileOAuthTokenUseCase: LoginWithMobileOAuthTokenUseCase) {
    this.#loginWithMobileOAuthTokenUseCase = loginWithMobileOAuthTokenUseCase;
  }

  @Post("apple/callback")
  @HttpCode(HttpStatus.OK)
  @Public()
  @RateLimit(SessionRateLimits.mobileOAuthLogin)
  @Header("Vary", "Origin, X-App-Version")
  @ApiAppVersionHeader()
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

    return toSocialAuthTokensResponse(result, appVersion);
  }

  @Post("google/callback")
  @HttpCode(HttpStatus.OK)
  @Public()
  @RateLimit(SessionRateLimits.mobileOAuthLogin)
  @Header("Vary", "Origin, X-App-Version")
  @ApiAppVersionHeader()
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

    return toSocialAuthTokensResponse(result, appVersion);
  }

  @Post("kakao/callback")
  @HttpCode(HttpStatus.OK)
  @Public()
  @RateLimit(SessionRateLimits.mobileOAuthLogin)
  @Header("Vary", "Origin, X-App-Version")
  @ApiAppVersionHeader()
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

    return toSocialAuthTokensResponse(result, appVersion);
  }

  @Post("naver/callback")
  @HttpCode(HttpStatus.OK)
  @Public()
  @RateLimit(SessionRateLimits.mobileOAuthLogin)
  @Header("Vary", "Origin, X-App-Version")
  @ApiAppVersionHeader()
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

    return toSocialAuthTokensResponse(result, appVersion);
  }
}
