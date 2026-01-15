import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Post,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiParam, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import {
	ApiConflictError,
	ApiCreatedResponse,
	ApiDoc,
	ApiErrorResponse,
	ApiNotFoundError,
	ApiSuccessResponse,
	ApiUnauthorizedError,
	SWAGGER_TAGS,
} from "@/common/swagger";

import { CurrentUser, type CurrentUserPayload, Public } from "./decorators";
import {
	AppleMobileCallbackDto,
	AuthTokensDto,
	ChangePasswordDto,
	CurrentUserDto,
	ForgotPasswordDto,
	GoogleMobileCallbackDto,
	KakaoMobileCallbackDto,
	LinkedAccountsResponseDto,
	LinkSocialAccountDto,
	LoginDto,
	MessageResponseDto,
	NaverMobileCallbackDto,
	RefreshTokensDto,
	RegisterDto,
	ResendVerificationDto,
	ResetPasswordDto,
	SessionListDto,
	UpdateProfileDto,
	UpdateProfileResponseDto,
	VerifyEmailDto,
} from "./dtos";
import { JwtAuthGuard, JwtRefreshGuard } from "./guards";
import { AuthService, type RequestMetadata } from "./services/auth.service";
import { OAuthService } from "./services/oauth.service";
import type { RefreshTokenPayload } from "./strategies/jwt-refresh.strategy";

/**
 * 인증 API 컨트롤러
 *
 * ## 🔐 인증 플로우 개요
 *
 * ### 신규 회원가입 플로우
 * ```
 * 1. POST /auth/register     → 계정 생성 + 인증 코드 이메일 발송
 * 2. POST /auth/verify-email → 이메일 인증 완료 + 토큰 발급
 * ```
 *
 * ### 로그인 플로우
 * ```
 * 1. POST /auth/login   → Access Token + Refresh Token 발급
 * 2. GET /auth/me       → 사용자 정보 조회 (Access Token 필요)
 * 3. POST /auth/refresh → 토큰 갱신 (Refresh Token 필요)
 * 4. POST /auth/logout  → 로그아웃 (Access Token 필요)
 * ```
 *
 * ### 비밀번호 재설정 플로우
 * ```
 * 1. POST /auth/forgot-password → 재설정 코드 이메일 발송
 * 2. POST /auth/reset-password  → 새 비밀번호 설정
 * ```
 */
@ApiTags(SWAGGER_TAGS.USER_AUTH)
@Controller("auth")
@UseGuards(JwtAuthGuard)
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private readonly oauthService: OAuthService,
	) {}

	// ============================================
	// 회원가입 및 인증
	// ============================================

	@Post("register")
	@Public()
	@ApiDoc({
		summary: "회원가입",
		description: `
## 📋 회원가입 (1/2단계)

이메일과 비밀번호로 새 계정을 생성합니다.
성공 시 입력한 이메일로 **6자리 인증 코드**가 발송됩니다.

### 🔄 전체 플로우
\`\`\`
[현재] POST /auth/register     → 계정 생성 + 인증 코드 발송
[다음] POST /auth/verify-email → 인증 완료 + 토큰 발급
\`\`\`

### 📝 비밀번호 규칙
- 최소 8자 이상
- 영문자 1개 이상 포함
- 숫자 1개 이상 포함

### ✅ 필수 동의 항목
- \`termsAgreed\`: 서비스 이용약관 동의 (필수)
- \`privacyAgreed\`: 개인정보처리방침 동의 (필수)
- \`marketingAgreed\`: 마케팅 정보 수신 동의 (선택)

### ⚠️ 주의사항
- 이미 가입된 이메일은 \`EMAIL_ALREADY_REGISTERED\` 에러 반환
- 인증 코드는 **10분간 유효**합니다
		`,
	})
	@ApiCreatedResponse({ type: MessageResponseDto })
	@ApiConflictError("EMAIL_ALREADY_REGISTERED")
	async register(@Body() dto: RegisterDto) {
		const result = await this.authService.register(dto);
		return {
			message: result.message,
			email: result.email,
		};
	}

	@Post("verify-email")
	@Public()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "이메일 인증",
		description: `
## ✉️ 이메일 인증 (2/2단계)

회원가입 시 발송된 6자리 인증 코드를 검증합니다.
인증 성공 시 **Access Token**과 **Refresh Token**이 발급되어 즉시 로그인 상태가 됩니다.

### 🔄 전체 플로우
\`\`\`
[이전] POST /auth/register     → 계정 생성 + 인증 코드 발송
[현재] POST /auth/verify-email → 인증 완료 + 토큰 발급
[완료] 이후 API 호출 시 Access Token 사용
\`\`\`

### 🎫 발급되는 토큰
| 토큰 | 용도 | 유효기간 |
|------|------|----------|
| Access Token | API 인증 헤더에 사용 | 15분 |
| Refresh Token | Access Token 갱신용 | 7일 |

### ⚠️ 에러 케이스
- \`VERIFICATION_CODE_INVALID\`: 잘못된 인증 코드
- \`VERIFICATION_CODE_EXPIRED\`: 만료된 인증 코드 (10분 초과)

### 💡 코드 재발송
인증 코드가 만료되었거나 수신하지 못한 경우:
\`POST /auth/resend-verification\` 호출
		`,
	})
	@ApiSuccessResponse({ type: AuthTokensDto })
	@ApiErrorResponse({ errorCode: "VERIFICATION_CODE_INVALID" })
	@ApiErrorResponse({ errorCode: "VERIFICATION_CODE_EXPIRED" })
	async verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request) {
		const metadata = this.extractMetadata(req);
		const result = await this.authService.verifyEmail(dto, metadata);
		return {
			userId: result.userId,
			accessToken: result.tokens.accessToken,
			refreshToken: result.tokens.refreshToken,
			name: result.name,
			profileImage: result.profileImage,
		};
	}

	@Post("resend-verification")
	@Public()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "인증 코드 재발송",
		description: `
## 🔄 인증 코드 재발송

회원가입 시 발송된 인증 코드를 다시 발송합니다.

### 📋 사용 케이스
- 인증 코드가 만료된 경우 (10분 초과)
- 이메일을 수신하지 못한 경우
- 인증 코드를 분실한 경우

### ⏱️ 재발송 제한
- 마지막 발송 후 **1분 이내** 재요청 시 \`VERIFICATION_RESEND_TOO_SOON\` 에러
- 스팸 방지를 위한 제한입니다

### ⚠️ 주의사항
- 이전에 발송된 인증 코드는 **무효화**됩니다
- 새로 발송된 코드만 유효합니다
		`,
	})
	@ApiSuccessResponse({ type: MessageResponseDto })
	@ApiErrorResponse({ errorCode: "VERIFICATION_RESEND_TOO_SOON" })
	async resendVerification(@Body() dto: ResendVerificationDto) {
		const result = await this.authService.resendVerification(dto.email);
		return result;
	}

	// ============================================
	// 로그인 및 로그아웃
	// ============================================

	@Post("login")
	@Public()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "로그인",
		description: `
## 🔑 로그인

이메일과 비밀번호로 로그인합니다.
성공 시 **Access Token**과 **Refresh Token**이 발급됩니다.

### 🎫 발급되는 토큰
| 토큰 | 용도 | 유효기간 | 저장 위치 권장 |
|------|------|----------|----------------|
| Access Token | API 인증 | 15분 | 메모리 |
| Refresh Token | 토큰 갱신 | 7일 | Secure Storage |

### 🔒 보안 정책
- **5회 연속 실패** 시 계정이 **15분간 잠금**됩니다
- 잠금 해제 후 다시 시도하거나 비밀번호 재설정을 이용하세요

### 📱 다중 기기 지원
- 여러 기기에서 동시 로그인 가능
- 각 기기별로 독립적인 세션이 생성됩니다
- \`GET /auth/sessions\`에서 활성 세션 확인 가능

### ⚠️ 에러 케이스
| 에러 코드 | 설명 |
|-----------|------|
| \`INVALID_CREDENTIALS\` | 이메일 또는 비밀번호 불일치 |
| \`ACCOUNT_LOCKED\` | 로그인 시도 초과로 계정 잠금 |
| \`EMAIL_NOT_VERIFIED\` | 이메일 인증 미완료 |
		`,
	})
	@ApiSuccessResponse({ type: AuthTokensDto })
	@ApiErrorResponse({ errorCode: "INVALID_CREDENTIALS" })
	@ApiErrorResponse({ errorCode: "ACCOUNT_LOCKED" })
	@ApiErrorResponse({ errorCode: "EMAIL_NOT_VERIFIED" })
	async login(@Body() dto: LoginDto, @Req() req: Request) {
		const metadata = this.extractMetadata(req);
		const result = await this.authService.login(dto, metadata);
		return {
			userId: result.userId,
			accessToken: result.tokens.accessToken,
			refreshToken: result.tokens.refreshToken,
			name: result.name,
			profileImage: result.profileImage,
		};
	}

	@Post("logout")
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "로그아웃",
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
	@ApiUnauthorizedError()
	async logout(@CurrentUser() user: CurrentUserPayload, @Req() req: Request) {
		const metadata = this.extractMetadata(req);
		await this.authService.logout(user.userId, user.sessionId, metadata);
		return { message: "로그아웃되었습니다." };
	}

	@Post("logout-all")
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "모든 기기에서 로그아웃",
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
	@ApiUnauthorizedError()
	async logoutAll(@CurrentUser() user: CurrentUserPayload) {
		await this.authService.logoutAll(user.userId);
		return { message: "모든 기기에서 로그아웃되었습니다." };
	}

	// ============================================
	// 토큰 관리
	// ============================================

	@Post("refresh")
	@Public()
	@UseGuards(JwtRefreshGuard)
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "토큰 갱신",
		description: `
## 🔄 토큰 갱신

Refresh Token을 사용하여 새로운 토큰 쌍을 발급받습니다.

### 🔐 인증 방식
\`Authorization: Bearer {refreshToken}\`

⚠️ **Access Token이 아닌 Refresh Token**을 사용해야 합니다!

### 📋 동작
1. Refresh Token 검증
2. 새 Access Token + Refresh Token 쌍 발급
3. 기존 Refresh Token 무효화 (Token Rotation)

### 🔒 Token Rotation
- 매 갱신 시 새로운 Refresh Token이 발급됩니다
- 이전 Refresh Token은 **즉시 무효화**됩니다
- 토큰 탈취 시 빠른 감지가 가능합니다

### ⚠️ 에러 케이스
| 에러 코드 | 설명 |
|-----------|------|
| \`REFRESH_TOKEN_INVALID\` | 유효하지 않은 Refresh Token |
| \`TOKEN_REUSE_DETECTED\` | 이미 사용된 토큰 재사용 감지 (보안 위협) |

### 🚨 TOKEN_REUSE_DETECTED 발생 시
토큰 재사용이 감지되면 **해당 토큰 패밀리 전체**가 무효화됩니다.
사용자는 다시 로그인해야 합니다.
		`,
	})
	@ApiSuccessResponse({ type: RefreshTokensDto })
	@ApiErrorResponse({ errorCode: "REFRESH_TOKEN_INVALID" })
	@ApiErrorResponse({ errorCode: "TOKEN_REUSE_DETECTED" })
	async refresh(@Req() req: Request) {
		const payload = req.user as RefreshTokenPayload;
		const result = await this.authService.refreshTokens(payload.refreshToken);
		return {
			accessToken: result.tokens.accessToken,
			refreshToken: result.tokens.refreshToken,
		};
	}

	// ============================================
	// 비밀번호 관리
	// ============================================

	@Post("forgot-password")
	@Public()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "비밀번호 찾기",
		description: `
## 🔑 비밀번호 찾기 (1/2단계)

비밀번호 재설정을 위한 6자리 인증 코드를 이메일로 발송합니다.

### 🔄 전체 플로우
\`\`\`
[현재] POST /auth/forgot-password → 재설정 코드 발송
[다음] POST /auth/reset-password  → 새 비밀번호 설정
\`\`\`

### ⏱️ 인증 코드 유효기간
- **10분**간 유효합니다
- 만료 시 다시 요청해야 합니다

### 🔒 보안
- 존재하지 않는 이메일에도 동일한 응답을 반환합니다
- 이는 이메일 존재 여부 노출을 방지하기 위함입니다
		`,
	})
	@ApiSuccessResponse({ type: MessageResponseDto })
	async forgotPassword(@Body() dto: ForgotPasswordDto) {
		const result = await this.authService.forgotPassword(dto.email);
		return result;
	}

	@Post("reset-password")
	@Public()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "비밀번호 재설정",
		description: `
## 🔑 비밀번호 재설정 (2/2단계)

인증 코드를 확인하고 새 비밀번호를 설정합니다.

### 🔄 전체 플로우
\`\`\`
[이전] POST /auth/forgot-password → 재설정 코드 발송
[현재] POST /auth/reset-password  → 새 비밀번호 설정
[완료] POST /auth/login으로 새 비밀번호 로그인
\`\`\`

### 📝 비밀번호 규칙
- 최소 8자 이상
- 영문자 1개 이상 포함
- 숫자 1개 이상 포함

### 📋 비밀번호 변경 후
- 모든 기존 세션이 **유지**됩니다
- 보안상 전체 로그아웃을 원하면 \`POST /auth/logout-all\` 호출

### ⚠️ 에러 케이스
- \`VERIFICATION_CODE_INVALID\`: 잘못된 인증 코드
- \`VERIFICATION_CODE_EXPIRED\`: 만료된 인증 코드
		`,
	})
	@ApiSuccessResponse({ type: MessageResponseDto })
	@ApiErrorResponse({ errorCode: "VERIFICATION_CODE_INVALID" })
	@ApiErrorResponse({ errorCode: "VERIFICATION_CODE_EXPIRED" })
	async resetPassword(@Body() dto: ResetPasswordDto) {
		const result = await this.authService.resetPassword(
			dto.email,
			dto.code,
			dto.newPassword,
		);
		return result;
	}

	@Patch("password")
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "비밀번호 변경",
		description: `
## 🔐 비밀번호 변경

로그인된 상태에서 비밀번호를 변경합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 요청 데이터
- \`currentPassword\`: 현재 비밀번호 (확인용)
- \`newPassword\`: 새 비밀번호

### 📝 비밀번호 규칙
- 최소 8자 이상
- 영문자 1개 이상 포함
- 숫자 1개 이상 포함

### 📋 비밀번호 변경 후
- 현재 세션은 **유지**됩니다
- 다른 기기 세션도 유지됩니다
- 전체 로그아웃을 원하면 \`POST /auth/logout-all\` 호출

### ⚠️ 에러 케이스
- \`INVALID_CREDENTIALS\`: 현재 비밀번호 불일치
		`,
	})
	@ApiSuccessResponse({ type: MessageResponseDto })
	@ApiUnauthorizedError()
	@ApiErrorResponse({ errorCode: "INVALID_CREDENTIALS" })
	async changePassword(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: ChangePasswordDto,
		@Req() req: Request,
	) {
		const metadata = this.extractMetadata(req);
		const result = await this.authService.changePassword(
			user.userId,
			dto.currentPassword,
			dto.newPassword,
			metadata,
		);
		return result;
	}

	// ============================================
	// 사용자 정보
	// ============================================

	@Get("me")
	@ApiBearerAuth()
	@ApiDoc({
		summary: "현재 사용자 정보 조회",
		description: `
## 👤 내 정보 조회

현재 로그인된 사용자의 기본 정보와 프로필을 조회합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📋 응답 데이터
- \`userId\`: 사용자 고유 ID
- \`email\`: 이메일 주소
- \`sessionId\`: 현재 세션 ID
- \`name\`: 사용자 이름 (없으면 null)
- \`profileImage\`: 프로필 이미지 URL (없으면 null)

### 💡 사용 케이스
- 로그인 상태 확인
- 사용자 정보 표시
- Access Token 유효성 검증
		`,
	})
	@ApiSuccessResponse({ type: CurrentUserDto })
	@ApiUnauthorizedError()
	async getMe(@CurrentUser() user: CurrentUserPayload) {
		return this.authService.getCurrentUser(
			user.userId,
			user.email,
			user.sessionId,
		);
	}

	@Patch("profile")
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "프로필 수정",
		description: `
## 👤 프로필 수정

사용자의 이름과 프로필 이미지를 수정합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 요청 필드
- \`name\`: 이름 (100자 이내, 선택)
- \`profileImage\`: 프로필 이미지 URL (500자 이내, null로 설정 시 삭제)

### ⚠️ 주의사항
- 최소 하나의 필드는 입력해야 합니다
- null 값을 전달하면 해당 필드가 삭제됩니다
		`,
	})
	@ApiSuccessResponse({ type: UpdateProfileResponseDto })
	@ApiUnauthorizedError()
	async updateProfile(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: UpdateProfileDto,
	) {
		return this.authService.updateProfile(user.userId, dto);
	}

	// ============================================
	// 세션 관리
	// ============================================

	@Get("sessions")
	@ApiBearerAuth()
	@ApiDoc({
		summary: "활성 세션 목록 조회",
		description: `
## 📱 활성 세션 목록

현재 로그인되어 있는 모든 기기/세션 목록을 조회합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📋 응답 데이터 (세션별)
| 필드 | 설명 |
|------|------|
| \`id\` | 세션 고유 ID |
| \`deviceName\` | 기기명 (예: iPhone 15) |
| \`deviceType\` | 기기 타입 (mobile/desktop/tablet) |
| \`ipAddress\` | 접속 IP |
| \`lastActiveAt\` | 마지막 활동 시간 |
| \`isCurrent\` | 현재 세션 여부 |

### 💡 사용 케이스
- 로그인된 기기 확인
- 의심스러운 세션 발견 시 종료
- 보안 점검
		`,
	})
	@ApiSuccessResponse({ type: SessionListDto })
	@ApiUnauthorizedError()
	async getSessions(@CurrentUser() user: CurrentUserPayload) {
		const sessions = await this.authService.getActiveSessions(user.userId);

		// 현재 세션 표시
		const sessionsWithCurrent = sessions.map((session) => ({
			...session,
			isCurrent: session.id === user.sessionId,
		}));

		return { sessions: sessionsWithCurrent };
	}

	@Delete("sessions/:sessionId")
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "특정 세션 종료",
		description: `
## 🔌 세션 종료

특정 기기의 세션을 원격으로 종료합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📋 동작
- 지정된 세션이 즉시 종료됩니다
- 해당 기기의 Access Token이 무효화됩니다
- 해당 기기의 Refresh Token도 무효화됩니다

### 💡 사용 케이스
- 분실한 기기 로그아웃
- 공용 PC에서 로그아웃 깜빡했을 때
- 의심스러운 접속 차단

### ⚠️ 에러 케이스
- \`SESSION_NOT_FOUND\`: 존재하지 않는 세션 ID
		`,
	})
	@ApiParam({
		name: "sessionId",
		description: "종료할 세션 ID (UUID)",
		example: "550e8400-e29b-41d4-a716-446655440000",
	})
	@ApiSuccessResponse({ type: MessageResponseDto })
	@ApiUnauthorizedError()
	@ApiNotFoundError("SESSION_NOT_FOUND")
	async revokeSession(
		@CurrentUser() user: CurrentUserPayload,
		@Param("sessionId") sessionId: string,
		@Req() req: Request,
	) {
		const metadata = this.extractMetadata(req);
		const result = await this.authService.revokeSession(
			user.userId,
			sessionId,
			metadata,
		);
		return result;
	}

	// ============================================
	// OAuth (소셜 로그인)
	// ============================================

	@Post("apple/callback")
	@Public()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "Apple 로그인 콜백",
		description: `
## 🍎 Apple 소셜 로그인

Apple Sign In 인증 후 콜백 처리 엔드포인트입니다.
Expo 앱에서 Apple 인증 완료 후 받은 데이터를 전송합니다.

### 📦 클라이언트 라이브러리 (Expo)
\`\`\`bash
npx expo install expo-apple-authentication
\`\`\`

### 🔄 Expo 클라이언트 구현 예시
\`\`\`typescript
import * as AppleAuthentication from 'expo-apple-authentication';

const handleAppleLogin = async () => {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    // 서버로 전송
    const response = await fetch('/v1/auth/apple/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile: {
          id: credential.user,
          email: credential.email,
          emailVerified: !!credential.email,
        },
        userName: credential.fullName
          ? \`\${credential.fullName.familyName || ''}\${credential.fullName.givenName || ''}\`.trim()
          : undefined,
      }),
    });

    const { accessToken, refreshToken } = await response.json();
    // 토큰 저장 및 로그인 처리
  } catch (error) {
    if (error.code === 'ERR_REQUEST_CANCELED') {
      // 사용자가 취소함
    }
  }
};
\`\`\`

### 🔄 인증 플로우
\`\`\`
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Expo App   │      │    Apple    │      │   Backend   │
└──────┬──────┘      └──────┬──────┘      └──────┬──────┘
       │                    │                    │
       │ signInAsync()      │                    │
       │───────────────────▶│                    │
       │                    │                    │
       │  credential        │                    │
       │◀───────────────────│                    │
       │                    │                    │
       │   POST /apple/callback                  │
       │────────────────────────────────────────▶│
       │                    │                    │
       │             { accessToken, refreshToken }
       │◀────────────────────────────────────────│
       │                    │                    │
\`\`\`

### 📝 요청 데이터
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| \`profile.id\` | string | ✅ | Apple 고유 사용자 ID (credential.user) |
| \`profile.email\` | string | ❌ | 이메일 (최초 로그인 시에만) |
| \`profile.emailVerified\` | boolean | ❌ | 이메일 인증 여부 |
| \`userName\` | string | ❌ | 사용자 이름 (최초 로그인 시에만) |

### ⚠️ 주의사항
- Apple은 사용자 이름/이메일을 **최초 로그인 시에만** 제공합니다
- 이후 로그인에서는 해당 필드가 비어있으므로 서버에서 저장된 정보를 사용합니다
- iOS 13.0 이상에서만 지원됩니다 (\`AppleAuthentication.isAvailableAsync()\`로 확인)
		`,
	})
	@ApiSuccessResponse({ type: AuthTokensDto })
	@ApiErrorResponse({ errorCode: "APPLE_TOKEN_VERIFICATION_FAILED" })
	async appleCallback(
		@Body() dto: AppleMobileCallbackDto,
		@Req() req: Request,
	) {
		const metadata = this.extractMetadata(req);
		const result = await this.oauthService.handleAppleMobileLogin(
			dto.idToken,
			dto.userName,
			{
				...metadata,
				deviceName: dto.deviceName ?? metadata.deviceName,
				deviceType: dto.deviceType ?? metadata.deviceType,
			},
		);

		return {
			userId: result.userId,
			accessToken: result.tokens.accessToken,
			refreshToken: result.tokens.refreshToken,
			name: result.name,
			profileImage: result.profileImage,
		};
	}

	@Post("google/callback")
	@Public()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "Google 로그인 콜백 (모바일)",
		description: `
## 🔵 Google 소셜 로그인 (Expo 모바일 앱용)

Expo 앱에서 \`expo-auth-session\`을 사용하여 Google OAuth 인증 완료 후,
사용자 프로필 정보를 전송하는 엔드포인트입니다.

---

### 📦 클라이언트 라이브러리 (Expo)
\`\`\`bash
npx expo install expo-auth-session expo-crypto expo-web-browser
\`\`\`

---

### 🔧 Google Cloud Console 설정
1. [Google Cloud Console](https://console.cloud.google.com)에서 프로젝트 생성
2. **APIs & Services > Credentials > Create Credentials > OAuth client ID**
3. OAuth 2.0 클라이언트 ID 생성:
   - **iOS**: 번들 ID 등록 (예: \`com.yourapp.mobile\`)
   - **Android**: SHA-1 지문 등록
   - **웹**: Redirect URI에 \`https://auth.expo.io/@username/appname\` 추가

---

### 🌐 호출해야 하는 API 목록

| 단계 | API | 메서드 | 설명 |
|------|-----|--------|------|
| 1 | \`https://accounts.google.com/o/oauth2/v2/auth\` | GET | 사용자 인증 페이지 (expo-auth-session이 자동 처리) |
| 2 | \`https://oauth2.googleapis.com/token\` | POST | Access Token 교환 (expo-auth-session이 자동 처리) |
| 3 | \`https://www.googleapis.com/userinfo/v2/me\` | GET | 사용자 정보 조회 (**직접 호출**) |
| 4 | \`POST /v1/auth/google/callback\` | POST | 백엔드로 프로필 전송 (**직접 호출**) |

---

### 📋 Step 1-2: OAuth 인증 (expo-auth-session 자동 처리)

\`expo-auth-session/providers/google\`을 사용하면 1단계, 2단계가 자동으로 처리됩니다.

\`\`\`typescript
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const [request, response, promptAsync] = Google.useAuthRequest({
  expoClientId: 'YOUR_EXPO_CLIENT_ID.apps.googleusercontent.com',
  iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
  androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
  scopes: ['profile', 'email'],
});

// 호출
const result = await promptAsync();
// result.type === 'success' 시 result.authentication.accessToken 획득
\`\`\`

---

### 📋 Step 3: 사용자 정보 조회 API

**엔드포인트**: \`GET https://www.googleapis.com/userinfo/v2/me\`

**요청 헤더**:
\`\`\`
Authorization: Bearer {accessToken}
\`\`\`

**응답 예시**:
\`\`\`json
{
  "id": "123456789012345678901",
  "email": "user@gmail.com",
  "verified_email": true,
  "name": "홍길동",
  "given_name": "길동",
  "family_name": "홍",
  "picture": "https://lh3.googleusercontent.com/..."
}
\`\`\`

**응답 필드 설명**:
| 필드 | 타입 | 설명 |
|------|------|------|
| \`id\` | string | Google 고유 사용자 ID |
| \`email\` | string | 이메일 주소 |
| \`verified_email\` | boolean | 이메일 인증 여부 |
| \`name\` | string | 전체 이름 |
| \`given_name\` | string | 이름 (First name) |
| \`family_name\` | string | 성 (Last name) |
| \`picture\` | string | 프로필 사진 URL |

---

### 📋 Step 4: 백엔드 API 호출

**엔드포인트**: \`POST /v1/auth/google/callback\`

**요청 헤더**:
\`\`\`
Content-Type: application/json
\`\`\`

**요청 바디**:
\`\`\`json
{
  "profile": {
    "id": "123456789012345678901",
    "email": "user@gmail.com",
    "emailVerified": true,
    "name": {
      "firstName": "길동",
      "lastName": "홍"
    },
    "picture": "https://lh3.googleusercontent.com/..."
  }
}
\`\`\`

**응답 예시**:
\`\`\`json
{
  "userId": "clx123...",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "name": "홍길동",
  "profileImage": "https://lh3.googleusercontent.com/..."
}
\`\`\`

---

### 🔄 전체 구현 예시

\`\`\`typescript
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export const useGoogleLogin = () => {
  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: 'YOUR_EXPO_CLIENT_ID.apps.googleusercontent.com',
    iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
    androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
    scopes: ['profile', 'email'],
  });

  const handleGoogleLogin = async () => {
    try {
      // Step 1-2: OAuth 인증 (자동 처리)
      const result = await promptAsync();

      if (result.type !== 'success' || !result.authentication) {
        throw new Error('Google OAuth failed');
      }

      const { accessToken } = result.authentication;

      // Step 3: Google API로 사용자 정보 조회
      const userInfoResponse = await fetch(
        'https://www.googleapis.com/userinfo/v2/me',
        {
          headers: { Authorization: \`Bearer \${accessToken}\` },
        }
      );

      if (!userInfoResponse.ok) {
        throw new Error('Failed to fetch user info');
      }

      const userInfo = await userInfoResponse.json();

      // Step 4: 백엔드로 프로필 전송
      const backendResponse = await fetch(
        'https://your-api.com/v1/auth/google/callback',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile: {
              id: userInfo.id,
              email: userInfo.email,
              emailVerified: userInfo.verified_email,
              name: {
                firstName: userInfo.given_name,
                lastName: userInfo.family_name,
              },
              picture: userInfo.picture,
            },
          }),
        }
      );

      if (!backendResponse.ok) {
        throw new Error('Backend authentication failed');
      }

      const { accessToken: jwtAccessToken, refreshToken } =
        await backendResponse.json();

      // 토큰 저장 (SecureStore 권장)
      await SecureStore.setItemAsync('accessToken', jwtAccessToken);
      await SecureStore.setItemAsync('refreshToken', refreshToken);

      return { success: true };
    } catch (error) {
      console.error('Google login error:', error);
      return { success: false, error };
    }
  };

  return { request, handleGoogleLogin };
};
\`\`\`

---

### 🔄 인증 플로우 다이어그램
\`\`\`
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Expo App   │      │   Google    │      │   Backend   │
└──────┬──────┘      └──────┬──────┘      └──────┬──────┘
       │                    │                    │
       │ [Step 1] promptAsync()                  │
       │ (accounts.google.com/o/oauth2/v2/auth)  │
       │───────────────────▶│                    │
       │                    │                    │
       │ [Step 2] accessToken                    │
       │ (oauth2.googleapis.com/token)           │
       │◀───────────────────│                    │
       │                    │                    │
       │ [Step 3] GET /userinfo/v2/me            │
       │───────────────────▶│                    │
       │                    │                    │
       │ userInfo (JSON)    │                    │
       │◀───────────────────│                    │
       │                    │                    │
       │ [Step 4] POST /v1/auth/google/callback  │
       │────────────────────────────────────────▶│
       │                    │                    │
       │             { accessToken, refreshToken }
       │◀────────────────────────────────────────│
       │                    │                    │
\`\`\`

---

### 📝 백엔드 요청 데이터 상세
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| \`profile.id\` | string | ✅ | Google 고유 사용자 ID |
| \`profile.email\` | string | ✅ | 이메일 주소 |
| \`profile.emailVerified\` | boolean | ❌ | 이메일 인증 여부 (기본: false) |
| \`profile.name.firstName\` | string | ❌ | 이름 (given_name) |
| \`profile.name.lastName\` | string | ❌ | 성 (family_name) |
| \`profile.picture\` | string | ❌ | 프로필 사진 URL |

### 🔒 권한 범위 (Scopes)
- \`profile\`: 기본 프로필 정보 (이름, 사진)
- \`email\`: 이메일 주소
		`,
	})
	@ApiSuccessResponse({ type: AuthTokensDto })
	@ApiErrorResponse({ errorCode: "GOOGLE_TOKEN_VERIFICATION_FAILED" })
	async googleCallback(
		@Body() dto: GoogleMobileCallbackDto,
		@Req() req: Request,
	) {
		const metadata = this.extractMetadata(req);
		const result = await this.oauthService.handleGoogleMobileLogin(
			dto.idToken,
			dto.userName,
			{
				...metadata,
				deviceName: dto.deviceName ?? metadata.deviceName,
				deviceType: dto.deviceType ?? metadata.deviceType,
			},
		);

		return {
			userId: result.userId,
			accessToken: result.tokens.accessToken,
			refreshToken: result.tokens.refreshToken,
			name: result.name,
			profileImage: result.profileImage,
		};
	}

	@Post("kakao/callback")
	@Public()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "Kakao 로그인 콜백 (모바일)",
		description: `
## 🟡 Kakao 소셜 로그인 (Expo 모바일 앱용)

Expo 앱에서 \`expo-auth-session\`을 사용하여 Kakao OAuth 인증 완료 후,
사용자 프로필 정보를 전송하는 엔드포인트입니다.

---

### 📦 클라이언트 라이브러리 (Expo)
\`\`\`bash
npx expo install expo-auth-session expo-crypto expo-web-browser
\`\`\`

---

### 🔧 Kakao Developers 설정
1. [Kakao Developers](https://developers.kakao.com)에서 애플리케이션 생성
2. **앱 키** 발급 (REST API 키 사용)
3. **플랫폼** 등록:
   - **iOS**: 번들 ID 등록
   - **Android**: 패키지명 + 키 해시 등록
4. **카카오 로그인** 활성화
5. **Redirect URI** 등록: \`https://auth.expo.io/@username/appname\`
6. **동의 항목** 설정:
   - 닉네임 (필수)
   - 프로필 사진 (선택)
   - 이메일 (선택 - 사용자 동의 필요)

---

### 🌐 호출해야 하는 API 목록

| 단계 | API | 메서드 | 설명 |
|------|-----|--------|------|
| 1 | \`https://kauth.kakao.com/oauth/authorize\` | GET | 사용자 인증 페이지 (expo-auth-session이 처리) |
| 2 | \`https://kauth.kakao.com/oauth/token\` | POST | Access Token 교환 (expo-auth-session이 처리) |
| 3 | \`https://kapi.kakao.com/v2/user/me\` | GET | 사용자 정보 조회 (**직접 호출**) |
| 4 | \`POST /v1/auth/kakao/callback\` | POST | 백엔드로 프로필 전송 (**직접 호출**) |

---

### 📋 Step 1-2: OAuth 인증 (expo-auth-session 처리)

Kakao는 \`expo-auth-session\`의 기본 provider가 없으므로 **수동 설정**이 필요합니다.

\`\`\`typescript
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const KAKAO_REST_API_KEY = 'YOUR_KAKAO_REST_API_KEY';

// Kakao OAuth Discovery 문서
const discovery = {
  authorizationEndpoint: 'https://kauth.kakao.com/oauth/authorize',
  tokenEndpoint: 'https://kauth.kakao.com/oauth/token',
};

const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'your-app-scheme', // app.json의 scheme과 일치
});

// Step 1: Authorization Code 요청
const authRequest = new AuthSession.AuthRequest({
  clientId: KAKAO_REST_API_KEY,
  scopes: ['profile_nickname', 'profile_image', 'account_email'],
  redirectUri,
});

const authResult = await authRequest.promptAsync(discovery);
// authResult.type === 'success' 시 authResult.params.code 획득

// Step 2: Access Token 교환
const tokenResult = await AuthSession.exchangeCodeAsync(
  {
    clientId: KAKAO_REST_API_KEY,
    code: authResult.params.code,
    redirectUri,
  },
  discovery
);
// tokenResult.accessToken 획득
\`\`\`

---

### 📋 Step 3: 사용자 정보 조회 API

**엔드포인트**: \`GET https://kapi.kakao.com/v2/user/me\`

**요청 헤더**:
\`\`\`
Authorization: Bearer {accessToken}
\`\`\`

**응답 예시**:
\`\`\`json
{
  "id": 1234567890,
  "connected_at": "2024-01-15T10:30:00Z",
  "kakao_account": {
    "profile_needs_agreement": false,
    "profile": {
      "nickname": "홍길동",
      "thumbnail_image_url": "https://k.kakaocdn.net/...",
      "profile_image_url": "https://k.kakaocdn.net/...",
      "is_default_image": false
    },
    "has_email": true,
    "email_needs_agreement": false,
    "is_email_valid": true,
    "is_email_verified": true,
    "email": "user@example.com"
  }
}
\`\`\`

**응답 필드 설명**:
| 필드 | 타입 | 설명 |
|------|------|------|
| \`id\` | number | Kakao 고유 사용자 ID (숫자) |
| \`kakao_account.email\` | string | 이메일 주소 (동의 시에만) |
| \`kakao_account.is_email_verified\` | boolean | 이메일 인증 여부 |
| \`kakao_account.profile.nickname\` | string | 카카오 닉네임 |
| \`kakao_account.profile.profile_image_url\` | string | 프로필 사진 URL (원본) |
| \`kakao_account.profile.thumbnail_image_url\` | string | 프로필 사진 URL (썸네일) |

---

### 📋 Step 4: 백엔드 API 호출

**엔드포인트**: \`POST /v1/auth/kakao/callback\`

**요청 헤더**:
\`\`\`
Content-Type: application/json
\`\`\`

**요청 바디**:
\`\`\`json
{
  "profile": {
    "id": "1234567890",
    "email": "user@example.com",
    "emailVerified": true,
    "name": "홍길동",
    "picture": "https://k.kakaocdn.net/..."
  }
}
\`\`\`

**⚠️ 주의**: \`id\`는 **문자열**로 변환해서 전송해야 합니다 (\`String(userInfo.id)\`)

**응답 예시**:
\`\`\`json
{
  "userId": "clx123...",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "name": "홍길동",
  "profileImage": "https://k.kakaocdn.net/..."
}
\`\`\`

---

### 🔄 전체 구현 예시

\`\`\`typescript
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';

WebBrowser.maybeCompleteAuthSession();

const KAKAO_REST_API_KEY = 'YOUR_KAKAO_REST_API_KEY';

const discovery = {
  authorizationEndpoint: 'https://kauth.kakao.com/oauth/authorize',
  tokenEndpoint: 'https://kauth.kakao.com/oauth/token',
};

export const useKakaoLogin = () => {
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'your-app-scheme',
  });

  const handleKakaoLogin = async () => {
    try {
      // Step 1: Authorization Code 요청
      const authRequest = new AuthSession.AuthRequest({
        clientId: KAKAO_REST_API_KEY,
        scopes: ['profile_nickname', 'profile_image', 'account_email'],
        redirectUri,
      });

      const authResult = await authRequest.promptAsync(discovery);

      if (authResult.type !== 'success') {
        throw new Error('Kakao OAuth cancelled or failed');
      }

      // Step 2: Access Token 교환
      const tokenResult = await AuthSession.exchangeCodeAsync(
        {
          clientId: KAKAO_REST_API_KEY,
          code: authResult.params.code,
          redirectUri,
        },
        discovery
      );

      // Step 3: Kakao API로 사용자 정보 조회
      const userInfoResponse = await fetch(
        'https://kapi.kakao.com/v2/user/me',
        {
          headers: { Authorization: \`Bearer \${tokenResult.accessToken}\` },
        }
      );

      if (!userInfoResponse.ok) {
        throw new Error('Failed to fetch Kakao user info');
      }

      const userInfo = await userInfoResponse.json();
      const kakaoAccount = userInfo.kakao_account;

      // Step 4: 백엔드로 프로필 전송
      const backendResponse = await fetch(
        'https://your-api.com/v1/auth/kakao/callback',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile: {
              id: String(userInfo.id), // 숫자를 문자열로 변환!
              email: kakaoAccount?.email,
              emailVerified: kakaoAccount?.is_email_verified ?? false,
              name: kakaoAccount?.profile?.nickname,
              picture: kakaoAccount?.profile?.profile_image_url,
            },
          }),
        }
      );

      if (!backendResponse.ok) {
        throw new Error('Backend authentication failed');
      }

      const { accessToken: jwtAccessToken, refreshToken } =
        await backendResponse.json();

      // 토큰 저장 (SecureStore 권장)
      await SecureStore.setItemAsync('accessToken', jwtAccessToken);
      await SecureStore.setItemAsync('refreshToken', refreshToken);

      return { success: true };
    } catch (error) {
      console.error('Kakao login error:', error);
      return { success: false, error };
    }
  };

  return { handleKakaoLogin };
};
\`\`\`

---

### 🔄 인증 플로우 다이어그램
\`\`\`
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Expo App   │      │    Kakao    │      │   Backend   │
└──────┬──────┘      └──────┬──────┘      └──────┬──────┘
       │                    │                    │
       │ [Step 1] promptAsync()                  │
       │ (kauth.kakao.com/oauth/authorize)       │
       │───────────────────▶│                    │
       │                    │                    │
       │ [Step 2] exchangeCodeAsync()            │
       │ (kauth.kakao.com/oauth/token)           │
       │───────────────────▶│                    │
       │                    │                    │
       │ accessToken        │                    │
       │◀───────────────────│                    │
       │                    │                    │
       │ [Step 3] GET /v2/user/me                │
       │ (kapi.kakao.com)   │                    │
       │───────────────────▶│                    │
       │                    │                    │
       │ userInfo (JSON)    │                    │
       │◀───────────────────│                    │
       │                    │                    │
       │ [Step 4] POST /v1/auth/kakao/callback   │
       │────────────────────────────────────────▶│
       │                    │                    │
       │             { accessToken, refreshToken }
       │◀────────────────────────────────────────│
       │                    │                    │
\`\`\`

---

### 📝 백엔드 요청 데이터 상세
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| \`profile.id\` | string | ✅ | Kakao 고유 사용자 ID (**문자열로 변환**) |
| \`profile.email\` | string | ❌ | 이메일 (사용자 동의 시에만) |
| \`profile.emailVerified\` | boolean | ❌ | 이메일 인증 여부 (기본: false) |
| \`profile.name\` | string | ❌ | 카카오 닉네임 |
| \`profile.picture\` | string | ❌ | 프로필 사진 URL |

### 🔒 권한 범위 (Scopes)
- \`profile_nickname\`: 닉네임 (필수)
- \`profile_image\`: 프로필 사진 (선택)
- \`account_email\`: 이메일 주소 (사용자 동의 필요)

### ⚠️ Kakao OAuth 주의사항
- **이메일**: 사용자가 동의해야만 제공됨 (필수 아님)
- **ID 타입**: Kakao API는 숫자로 반환하지만, 백엔드에는 문자열로 전송
- **Redirect URI**: Kakao Developers에서 등록한 URI와 정확히 일치해야 함
		`,
	})
	@ApiSuccessResponse({ type: AuthTokensDto })
	@ApiErrorResponse({ errorCode: "KAKAO_TOKEN_VERIFICATION_FAILED" })
	async kakaoCallback(
		@Body() dto: KakaoMobileCallbackDto,
		@Req() req: Request,
	) {
		const metadata = this.extractMetadata(req);
		const result = await this.oauthService.handleKakaoMobileLogin(
			dto.accessToken,
			dto.userName,
			{
				...metadata,
				deviceName: dto.deviceName ?? metadata.deviceName,
				deviceType: dto.deviceType ?? metadata.deviceType,
			},
		);

		return {
			userId: result.userId,
			accessToken: result.tokens.accessToken,
			refreshToken: result.tokens.refreshToken,
			name: result.name,
			profileImage: result.profileImage,
		};
	}

	@Post("naver/callback")
	@Public()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "Naver 로그인 콜백 (모바일)",
		description: `
## 🟢 Naver 소셜 로그인 (Expo 모바일 앱용)

Expo 앱에서 \`expo-auth-session\`을 사용하여 Naver OAuth 인증 완료 후,
사용자 프로필 정보를 전송하는 엔드포인트입니다.

---

### 📦 클라이언트 라이브러리 (Expo)
\`\`\`bash
npx expo install expo-auth-session expo-crypto expo-web-browser
\`\`\`

---

### 🔧 Naver Developers 설정
1. [Naver Developers](https://developers.naver.com)에서 애플리케이션 등록
2. **사용 API**: 네이버 로그인 선택
3. **서비스 환경** 추가:
   - **iOS**: URL Scheme 등록 (예: \`naverlogin\`)
   - **Android**: 패키지명 + 다운로드 마켓 URL 등록
4. **Callback URL** 등록: \`https://auth.expo.io/@username/appname\`
5. **API 권한** 설정 (제공 정보 선택):
   - 회원이름 (필수)
   - 이메일 (필수)
   - 프로필 사진 (선택)
   - 닉네임 (선택)

---

### 🌐 호출해야 하는 API 목록

| 단계 | API | 메서드 | 설명 |
|------|-----|--------|------|
| 1 | \`https://nid.naver.com/oauth2.0/authorize\` | GET | 사용자 인증 페이지 (expo-auth-session이 처리) |
| 2 | \`https://nid.naver.com/oauth2.0/token\` | POST | Access Token 교환 (**직접 호출** - client_secret 필요) |
| 3 | \`https://openapi.naver.com/v1/nid/me\` | GET | 사용자 정보 조회 (**직접 호출**) |
| 4 | \`POST /v1/auth/naver/callback\` | POST | 백엔드로 프로필 전송 (**직접 호출**) |

---

### 📋 Step 1: Authorization Code 요청 (expo-auth-session 처리)

Naver는 \`expo-auth-session\`의 기본 provider가 없으므로 **수동 설정**이 필요합니다.

\`\`\`typescript
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const NAVER_CLIENT_ID = 'YOUR_NAVER_CLIENT_ID';

// Naver OAuth Discovery 문서
const discovery = {
  authorizationEndpoint: 'https://nid.naver.com/oauth2.0/authorize',
  tokenEndpoint: 'https://nid.naver.com/oauth2.0/token',
};

const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'your-app-scheme', // app.json의 scheme과 일치
});

// Authorization Code 요청
const authRequest = new AuthSession.AuthRequest({
  clientId: NAVER_CLIENT_ID,
  redirectUri,
  responseType: AuthSession.ResponseType.Code,
  state: 'random-state-string', // CSRF 방지용
});

const authResult = await authRequest.promptAsync(discovery);
// authResult.type === 'success' 시 authResult.params.code 획득
\`\`\`

---

### 📋 Step 2: Access Token 교환 API

**⚠️ 중요**: Naver는 \`client_secret\`이 필수입니다. expo-auth-session의 \`exchangeCodeAsync\`를 사용할 수 없으므로 **직접 호출**해야 합니다.

**엔드포인트**: \`POST https://nid.naver.com/oauth2.0/token\`

**요청 파라미터** (URL Query String):
| 파라미터 | 필수 | 설명 |
|----------|------|------|
| \`grant_type\` | ✅ | \`authorization_code\` (고정값) |
| \`client_id\` | ✅ | 애플리케이션 Client ID |
| \`client_secret\` | ✅ | 애플리케이션 Client Secret |
| \`code\` | ✅ | Authorization Code (Step 1에서 획득) |
| \`state\` | ❌ | CSRF 검증용 state 값 |

**요청 예시**:
\`\`\`
POST https://nid.naver.com/oauth2.0/token
  ?grant_type=authorization_code
  &client_id=YOUR_CLIENT_ID
  &client_secret=YOUR_CLIENT_SECRET
  &code=AUTHORIZATION_CODE
  &state=RANDOM_STATE
\`\`\`

**응답 예시**:
\`\`\`json
{
  "access_token": "AAAAOLtP40eH...",
  "refresh_token": "c8ceMEJisO4Se7...",
  "token_type": "bearer",
  "expires_in": "3600"
}
\`\`\`

**응답 필드 설명**:
| 필드 | 타입 | 설명 |
|------|------|------|
| \`access_token\` | string | 사용자 정보 조회용 Access Token |
| \`refresh_token\` | string | Access Token 갱신용 |
| \`token_type\` | string | 토큰 타입 (bearer) |
| \`expires_in\` | string | 만료 시간 (초) |

---

### 📋 Step 3: 사용자 정보 조회 API

**엔드포인트**: \`GET https://openapi.naver.com/v1/nid/me\`

**요청 헤더**:
\`\`\`
Authorization: Bearer {access_token}
\`\`\`

**응답 예시**:
\`\`\`json
{
  "resultcode": "00",
  "message": "success",
  "response": {
    "id": "32742776",
    "nickname": "홍길동",
    "profile_image": "https://ssl.pstatic.net/static/pwe/address/img_profile.png",
    "email": "user@naver.com",
    "name": "홍길동",
    "birthday": "01-01",
    "birthyear": "1990",
    "gender": "M",
    "mobile": "010-1234-5678"
  }
}
\`\`\`

**응답 필드 설명** (\`response\` 객체 내부):
| 필드 | 타입 | 설명 | 동의 필요 |
|------|------|------|----------|
| \`id\` | string | 네이버 고유 사용자 ID | 필수 제공 |
| \`email\` | string | 이메일 주소 | 이메일 동의 |
| \`name\` | string | 사용자 실명 | 이름 동의 |
| \`nickname\` | string | 네이버 닉네임 | 닉네임 동의 |
| \`profile_image\` | string | 프로필 사진 URL | 프로필 사진 동의 |
| \`gender\` | string | 성별 (M/F) | 성별 동의 |
| \`birthday\` | string | 생일 (MM-DD) | 생일 동의 |
| \`birthyear\` | string | 출생연도 (YYYY) | 출생연도 동의 |
| \`mobile\` | string | 휴대전화 번호 | 휴대전화 동의 |

---

### 📋 Step 4: 백엔드 API 호출

**엔드포인트**: \`POST /v1/auth/naver/callback\`

**요청 헤더**:
\`\`\`
Content-Type: application/json
\`\`\`

**요청 바디**:
\`\`\`json
{
  "profile": {
    "id": "32742776",
    "email": "user@naver.com",
    "name": "홍길동",
    "picture": "https://ssl.pstatic.net/static/pwe/address/img_profile.png"
  }
}
\`\`\`

**응답 예시**:
\`\`\`json
{
  "userId": "clx123...",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "name": "홍길동",
  "profileImage": "https://ssl.pstatic.net/static/pwe/address/img_profile.png"
}
\`\`\`

---

### 🔄 전체 구현 예시

\`\`\`typescript
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';

WebBrowser.maybeCompleteAuthSession();

const NAVER_CLIENT_ID = 'YOUR_NAVER_CLIENT_ID';
const NAVER_CLIENT_SECRET = 'YOUR_NAVER_CLIENT_SECRET'; // ⚠️ 보안 주의

const discovery = {
  authorizationEndpoint: 'https://nid.naver.com/oauth2.0/authorize',
  tokenEndpoint: 'https://nid.naver.com/oauth2.0/token',
};

export const useNaverLogin = () => {
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'your-app-scheme',
  });

  const handleNaverLogin = async () => {
    try {
      // Step 1: Authorization Code 요청
      const state = Math.random().toString(36).substring(7);
      const authRequest = new AuthSession.AuthRequest({
        clientId: NAVER_CLIENT_ID,
        redirectUri,
        responseType: AuthSession.ResponseType.Code,
        extraParams: { state },
      });

      const authResult = await authRequest.promptAsync(discovery);

      if (authResult.type !== 'success') {
        throw new Error('Naver OAuth cancelled or failed');
      }

      // Step 2: Access Token 교환 (직접 호출 - client_secret 필요)
      const tokenUrl = new URL('https://nid.naver.com/oauth2.0/token');
      tokenUrl.searchParams.set('grant_type', 'authorization_code');
      tokenUrl.searchParams.set('client_id', NAVER_CLIENT_ID);
      tokenUrl.searchParams.set('client_secret', NAVER_CLIENT_SECRET);
      tokenUrl.searchParams.set('code', authResult.params.code);
      tokenUrl.searchParams.set('state', state);

      const tokenResponse = await fetch(tokenUrl.toString(), {
        method: 'POST',
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange authorization code');
      }

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        throw new Error(tokenData.error_description || 'Token exchange failed');
      }

      // Step 3: Naver API로 사용자 정보 조회
      const userInfoResponse = await fetch(
        'https://openapi.naver.com/v1/nid/me',
        {
          headers: { Authorization: \`Bearer \${tokenData.access_token}\` },
        }
      );

      if (!userInfoResponse.ok) {
        throw new Error('Failed to fetch Naver user info');
      }

      const userInfoResult = await userInfoResponse.json();

      if (userInfoResult.resultcode !== '00') {
        throw new Error(userInfoResult.message || 'Failed to get user info');
      }

      const naverProfile = userInfoResult.response;

      // Step 4: 백엔드로 프로필 전송
      const backendResponse = await fetch(
        'https://your-api.com/v1/auth/naver/callback',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile: {
              id: naverProfile.id,
              email: naverProfile.email,
              name: naverProfile.name || naverProfile.nickname,
              picture: naverProfile.profile_image,
            },
          }),
        }
      );

      if (!backendResponse.ok) {
        throw new Error('Backend authentication failed');
      }

      const { accessToken: jwtAccessToken, refreshToken } =
        await backendResponse.json();

      // 토큰 저장 (SecureStore 권장)
      await SecureStore.setItemAsync('accessToken', jwtAccessToken);
      await SecureStore.setItemAsync('refreshToken', refreshToken);

      return { success: true };
    } catch (error) {
      console.error('Naver login error:', error);
      return { success: false, error };
    }
  };

  return { handleNaverLogin };
};
\`\`\`

---

### 🔄 인증 플로우 다이어그램
\`\`\`
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Expo App   │      │    Naver    │      │   Backend   │
└──────┬──────┘      └──────┬──────┘      └──────┬──────┘
       │                    │                    │
       │ [Step 1] promptAsync()                  │
       │ (nid.naver.com/oauth2.0/authorize)      │
       │───────────────────▶│                    │
       │                    │                    │
       │ code + state       │                    │
       │◀───────────────────│                    │
       │                    │                    │
       │ [Step 2] POST /oauth2.0/token           │
       │ (nid.naver.com - client_secret 포함)    │
       │───────────────────▶│                    │
       │                    │                    │
       │ access_token       │                    │
       │◀───────────────────│                    │
       │                    │                    │
       │ [Step 3] GET /v1/nid/me                 │
       │ (openapi.naver.com)│                    │
       │───────────────────▶│                    │
       │                    │                    │
       │ userInfo (JSON)    │                    │
       │◀───────────────────│                    │
       │                    │                    │
       │ [Step 4] POST /v1/auth/naver/callback   │
       │────────────────────────────────────────▶│
       │                    │                    │
       │             { accessToken, refreshToken }
       │◀────────────────────────────────────────│
       │                    │                    │
\`\`\`

---

### 📝 백엔드 요청 데이터 상세
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| \`profile.id\` | string | ✅ | Naver 고유 사용자 ID |
| \`profile.email\` | string | ❌ | 이메일 주소 (사용자 동의 시) |
| \`profile.name\` | string | ❌ | 이름 또는 닉네임 |
| \`profile.picture\` | string | ❌ | 프로필 사진 URL |

### 🔒 API 권한 (제공 정보 선택)
- **회원이름** (이름): 사용자 실명
- **이메일**: 네이버 이메일 주소
- **프로필 사진**: 프로필 이미지 URL
- **닉네임**: 네이버 닉네임 (이름 대신 사용 가능)

### ⚠️ Naver OAuth 주의사항
- **client_secret 필수**: 토큰 교환 시 반드시 필요 (Kakao, Google과 다름)
- **보안**: client_secret을 앱에 직접 넣으면 보안 위험 → 프록시 서버 사용 권장
- **state 파라미터**: CSRF 공격 방지용으로 권장
- **Redirect URI**: Naver Developers에 등록한 Callback URL과 정확히 일치해야 함
- **동의 항목**: 사용자가 거부하면 해당 정보는 null로 반환됨
		`,
	})
	@ApiSuccessResponse({ type: AuthTokensDto })
	@ApiErrorResponse({ errorCode: "NAVER_TOKEN_VERIFICATION_FAILED" })
	async naverCallback(
		@Body() dto: NaverMobileCallbackDto,
		@Req() req: Request,
	) {
		const metadata = this.extractMetadata(req);
		const result = await this.oauthService.handleNaverMobileLogin(
			dto.accessToken,
			dto.userName,
			{
				...metadata,
				deviceName: dto.deviceName ?? metadata.deviceName,
				deviceType: dto.deviceType ?? metadata.deviceType,
			},
		);

		return {
			userId: result.userId,
			accessToken: result.tokens.accessToken,
			refreshToken: result.tokens.refreshToken,
			name: result.name,
			profileImage: result.profileImage,
		};
	}

	// ============================================
	// 소셜 계정 연동 관리
	// ============================================

	@Post("link")
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "소셜 계정 연동",
		description: `
## 🔗 소셜 계정 연동

로그인된 사용자 계정에 소셜 계정을 추가로 연동합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📝 요청 방법
- **Apple/Google**: idToken 제공
- **Kakao/Naver**: accessToken 제공

### ⚠️ 주의사항
- 이미 다른 사용자에 연결된 소셜 계정은 연동할 수 없습니다
- 동일한 소셜 계정을 중복 연동하면 "이미 연결된 계정입니다" 메시지를 반환합니다
		`,
	})
	@ApiSuccessResponse({ type: MessageResponseDto })
	@ApiUnauthorizedError()
	@ApiErrorResponse({ errorCode: "APPLE_ACCOUNT_ALREADY_LINKED" })
	async linkSocialAccount(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: LinkSocialAccountDto,
	) {
		return this.oauthService.linkSocialAccountWithToken(user.userId, dto);
	}

	@Get("linked-accounts")
	@ApiBearerAuth()
	@ApiDoc({
		summary: "연결된 소셜 계정 목록",
		description: `
## 🔗 연결된 소셜 계정 조회

현재 사용자에 연결된 소셜 계정 목록을 조회합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### 📋 응답 데이터
- \`provider\`: 소셜 제공자 (APPLE, GOOGLE, KAKAO 등)
- \`linkedAt\`: 연결 일시
		`,
	})
	@ApiSuccessResponse({ type: LinkedAccountsResponseDto })
	@ApiUnauthorizedError()
	async getLinkedAccounts(@CurrentUser() user: CurrentUserPayload) {
		const accounts = await this.oauthService.getLinkedAccounts(user.userId);
		return { accounts };
	}

	@Delete("linked-accounts/:provider")
	@ApiBearerAuth()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "소셜 계정 연결 해제",
		description: `
## 🔓 소셜 계정 연결 해제

연결된 소셜 계정을 해제합니다.

### 🔐 인증 필요
\`Authorization: Bearer {accessToken}\`

### ⚠️ 제한사항
- 마지막 로그인 수단은 해제할 수 없습니다
- 비밀번호 또는 다른 소셜 계정이 있어야 해제 가능
		`,
	})
	@ApiParam({
		name: "provider",
		description: "소셜 로그인 제공자",
		enum: ["APPLE", "GOOGLE", "KAKAO", "NAVER"],
		example: "GOOGLE",
	})
	@ApiSuccessResponse({ type: MessageResponseDto })
	@ApiUnauthorizedError()
	@ApiErrorResponse({ errorCode: "CANNOT_UNLINK_LAST_ACCOUNT" })
	async unlinkAccount(
		@CurrentUser() user: CurrentUserPayload,
		@Param("provider") provider: "APPLE" | "GOOGLE" | "KAKAO" | "NAVER",
	) {
		return this.oauthService.unlinkAccount(user.userId, provider);
	}

	// ============================================
	// Helper Methods
	// ============================================

	/**
	 * 요청에서 메타데이터 추출
	 */
	private extractMetadata(req: Request): RequestMetadata {
		const forwarded = req.headers["x-forwarded-for"];
		const ip = Array.isArray(forwarded)
			? forwarded[0]
			: forwarded?.split(",")[0] || req.ip;

		return {
			ip: ip || undefined,
			userAgent: req.headers["user-agent"],
			deviceName: req.headers["x-device-name"] as string | undefined,
			deviceType: req.headers["x-device-type"] as string | undefined,
		};
	}
}
