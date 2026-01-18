import { randomBytes } from "node:crypto";
import { ErrorCode } from "@aido/errors";
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Logger,
	Param,
	Patch,
	Post,
	Query,
	Req,
	Res,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";

import { BusinessException } from "@/common/exception/services/business-exception.service";
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

import {
	mapToAuthTokensResponse,
	mapToCurrentUserResponse,
	mapToExchangeCodeResponse,
	mapToMessageResponse,
	mapToRefreshTokensResponse,
	mapToRegisterResponse,
	mapToUpdateProfileResponse,
} from "./auth.mapper";
import { CurrentUser, type CurrentUserPayload, Public } from "./decorators";
import {
	AppleMobileCallbackDto,
	AuthTokensDto,
	ChangePasswordDto,
	CurrentUserDto,
	ExchangeCodeDto,
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
	private readonly logger = new Logger(AuthController.name);

	constructor(
		private readonly authService: AuthService,
		private readonly oauthService: OAuthService,
	) {}

	/**
	 * OAuth 콜백 에러를 URLSearchParams로 변환
	 * BusinessException인 경우 에러 코드를 포함
	 */
	private buildOAuthErrorParams(
		error: unknown,
		state: string,
	): URLSearchParams {
		let errorCode = "authentication_failed";
		let errorMessage = "Unknown error";

		if (error instanceof BusinessException) {
			errorCode = error.errorCode;
			errorMessage = error.message;
		} else if (error instanceof Error) {
			errorMessage = error.message;
		}

		return new URLSearchParams({
			error: errorCode,
			error_description: errorMessage,
			state,
		});
	}

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

### 🔄 이미 가입한 이메일로 재시도 시

만약 이전에 회원가입을 시도했지만 이메일 인증을 완료하지 않은 경우:

1. **회원가입 시도** → \`EMAIL_ALREADY_REGISTERED\` 에러 반환
2. **프론트엔드**: "이미 가입된 이메일입니다. 로그인하시겠습니까?" 안내
3. **사용자**: 로그인 버튼 클릭
4. **로그인 시도** → \`EMAIL_NOT_VERIFIED\` 에러 반환
5. **프론트엔드**: 자동으로 이메일 인증 화면으로 이동
6. **프론트엔드**: 자동으로 \`POST /auth/resend-verification\` 호출
7. **사용자**: 새로 받은 인증 코드로 인증 완료

이 플로우를 통해 이메일 인증을 완료하지 못한 사용자도 쉽게 복구할 수 있습니다.
		`,
	})
	@ApiCreatedResponse({ type: MessageResponseDto })
	@ApiConflictError(ErrorCode.EMAIL_0501)
	async register(@Body() dto: RegisterDto) {
		const result = await this.authService.register(dto);
		return mapToRegisterResponse(result);
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
	@ApiErrorResponse({ errorCode: ErrorCode.EMAIL_0502 })
	@ApiErrorResponse({ errorCode: ErrorCode.EMAIL_0504 })
	@ApiErrorResponse({ errorCode: ErrorCode.EMAIL_0505 })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0604 })
	async verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request) {
		const metadata = this.extractMetadata(req);
		const result = await this.authService.verifyEmail(dto, metadata);
		return mapToAuthTokensResponse(result);
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

### 🔄 자동 호출 시나리오

프론트엔드는 다음 상황에서 이 API를 **자동으로** 호출해야 합니다:

#### 1. **로그인 시 \`EMAIL_NOT_VERIFIED\` 에러 발생**
- 사용자를 이메일 인증 화면으로 이동시킨 후
- 자동으로 이 API를 호출하여 새 인증 코드 발송
- 사용자는 바로 이메일 인증을 진행할 수 있습니다

#### 2. **회원가입 시 \`EMAIL_ALREADY_REGISTERED\` 에러 → 로그인 → \`EMAIL_NOT_VERIFIED\` 에러 발생**
- 위와 동일한 플로우로 자동 복구 가능
- 사용자는 복잡한 단계 없이 바로 이메일 인증을 진행할 수 있습니다

#### 3. **사용자가 명시적으로 "코드 재발송" 버튼 클릭**
- 인증 화면에서 "코드를 받지 못했나요?" 버튼 제공
- 해당 버튼 클릭 시 이 API 호출
- 다만 **1분 쿨다운** 제한이 있으므로, 너무 빈번한 호출 방지

이를 통해 사용자는 복잡한 단계 없이 바로 이메일 인증을 진행할 수 있습니다.
		`,
	})
	@ApiSuccessResponse({ type: MessageResponseDto })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0602 })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0604 })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0605 })
	@ApiErrorResponse({ errorCode: ErrorCode.VERIFY_0753 })
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

### 🔄 이메일 미인증 사용자 복구 플로우

\`EMAIL_NOT_VERIFIED\` 에러를 받은 경우, 프론트엔드는 다음과 같이 처리해야 합니다:

**자동 복구 플로우:**
1. \`EMAIL_NOT_VERIFIED\` 에러 감지
2. 자동으로 이메일 인증 화면(\`/verify-email\`)으로 이동
3. 자동으로 \`POST /auth/resend-verification\` 호출하여 인증 코드 재발송
4. 사용자는 이메일에서 받은 6자리 코드 입력
5. \`POST /auth/verify-email\`로 인증 완료 → 자동 로그인

**프론트엔드 구현 예시:**
\`\`\`typescript
try {
  const response = await loginApi(email, password);
} catch (error) {
  if (error.code === 'EMAIL_NOT_VERIFIED') {
    // 자동으로 인증 화면으로 이동
    navigate('/verify-email', { state: { email } });
    // 자동으로 인증 코드 재발송
    await resendVerificationApi(email);
    // 사용자에게 "인증 코드가 재발송되었습니다" 안내
  }
}
\`\`\`

이 방식으로 사용자는 회원가입을 다시 시작할 필요 없이 바로 이메일 인증을 완료할 수 있습니다.
		`,
	})
	@ApiSuccessResponse({ type: AuthTokensDto })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0602 })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0605 })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0607 })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0608 })
	async login(@Body() dto: LoginDto, @Req() req: Request) {
		const metadata = this.extractMetadata(req);
		const result = await this.authService.login(dto, metadata);
		return mapToAuthTokensResponse(result);
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
		return mapToMessageResponse("로그아웃되었습니다.");
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
		return mapToMessageResponse("모든 기기에서 로그아웃되었습니다.");
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
	@ApiErrorResponse({ errorCode: ErrorCode.AUTH_0104 })
	@ApiErrorResponse({ errorCode: ErrorCode.SESSION_0704 })
	async refresh(@Req() req: Request) {
		const payload = req.user as RefreshTokenPayload;
		const result = await this.authService.refreshTokens(payload.refreshToken);
		return mapToRefreshTokensResponse(result);
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
	@ApiErrorResponse({ errorCode: ErrorCode.EMAIL_0504 })
	@ApiErrorResponse({ errorCode: ErrorCode.EMAIL_0505 })
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0602 })
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
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0602 })
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
		const result = await this.authService.getCurrentUser(
			user.userId,
			user.email,
			user.sessionId,
		);
		return mapToCurrentUserResponse(result);
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
		const result = await this.authService.updateProfile(user.userId, dto);
		return mapToUpdateProfileResponse(result);
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
	@ApiNotFoundError(ErrorCode.SESSION_0701)
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
	// OAuth 교환 코드 (Exchange Code)
	// ============================================

	@Post("exchange")
	@Public()
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "OAuth 교환 코드로 토큰 획득",
		description: `
## 🔐 OAuth 교환 코드 → JWT 토큰 교환

OAuth Web 콜백에서 발급된 **일회용 교환 코드**를 사용하여 JWT 토큰을 획득합니다.

### 🔄 플로우 개요
\`\`\`
1. 소셜 로그인 완료 → 딥링크로 교환 코드 전달
   aido://auth/callback?code=xxx&state=xxx

2. 앱에서 이 엔드포인트 호출
   POST /v1/auth/exchange { code: "xxx" }

3. JWT 토큰 반환
   { accessToken, refreshToken, userId, ... }
\`\`\`

### 🛡️ 보안 특성
- **일회용**: 교환 코드는 한 번만 사용 가능
- **만료 시간**: 10분 이내 사용 필요
- **토큰 보호**: URL에 JWT 토큰이 노출되지 않음

### 📝 요청 예시
\`\`\`bash
curl -X POST https://api.aido.com/v1/auth/exchange \\
  -H "Content-Type: application/json" \\
  -d '{"code": "abc123..."}'
\`\`\`

### ✅ 성공 응답
\`\`\`json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "userId": "user_123",
  "userName": "홍길동",
  "profileImage": "https://..."
}
\`\`\`

### ❌ 에러 케이스
| 에러 | 설명 |
|------|------|
| \`INVALID_CREDENTIALS\` | 유효하지 않거나 만료/사용된 교환 코드 |
		`,
	})
	@ApiCreatedResponse({
		description: "토큰 교환 성공",
		type: AuthTokensDto,
	})
	@ApiUnauthorizedError()
	async exchangeCode(@Body() dto: ExchangeCodeDto): Promise<AuthTokensDto> {
		const result = await this.oauthService.exchangeCodeForTokens(dto.code);
		return mapToExchangeCodeResponse(result);
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

### 📦 필요한 라이브러리 (Expo)
\`\`\`bash
npx expo install expo-apple-authentication
\`\`\`

### 🔐 왜 expo-apple-authentication을 사용하는가?

**네이티브 SDK 직접 연동의 이점:**
1. **보안성**: Apple의 네이티브 Sign In 시스템 직접 사용
2. **UX**: Face ID/Touch ID 자동 지원, 시스템 UI 제공
3. **간편성**: OAuth 플로우 없이 credential 직접 획득
4. **신뢰성**: Apple의 공식 인증 흐름 보장

**WebView/브라우저 방식 대비 장점:**
- 피싱 방지: 시스템 레벨 인증 UI (위조 불가)
- 자격 증명 보호: 앱이 사용자 Apple ID 비밀번호에 접근 불가
- 생체 인증 통합: Face ID/Touch ID 자동 연동

### 🔒 서버 측 JWKS 검증이 필요한 이유

**왜 클라이언트가 보낸 데이터를 신뢰하지 않는가?**

클라이언트에서 받은 \`identityToken\`을 서버에서 직접 검증하는 이유:

| 위협 | 클라이언트만 신뢰 시 | 서버 검증 시 |
|------|---------------------|-------------|
| 토큰 위조 | ❌ 악의적 앱이 가짜 토큰 생성 가능 | ✅ Apple 공개키로 서명 검증 |
| 중간자 공격 | ❌ 네트워크에서 토큰 변조 가능 | ✅ 서명 불일치로 탐지 |
| 재생 공격 | ❌ 이전 토큰 재사용 가능 | ✅ exp/iat 클레임으로 만료 검증 |
| 권한 상승 | ❌ 다른 사용자 ID 사칭 가능 | ✅ sub 클레임으로 사용자 확인 |

**서버에서 수행하는 검증 (apple-signin-auth 라이브러리):**
\`\`\`typescript
// JWKS 검증 과정
1. Apple의 공개키 조회: https://appleid.apple.com/auth/keys
2. ID Token의 header에서 kid(Key ID) 추출
3. 해당 kid에 맞는 공개키로 서명 검증
4. 클레임 검증:
   - iss: "https://appleid.apple.com" (발급자)
   - aud: 앱의 Bundle ID (대상자)
   - exp: 토큰 만료 시간
   - sub: Apple 사용자 고유 ID
\`\`\`

**ID Token 구조 (JWT):**
\`\`\`
header.payload.signature
  │       │        │
  │       │        └─ Apple 개인키로 서명 (서버가 공개키로 검증)
  │       └─ 사용자 정보 (sub, email, email_verified 등)
  └─ 알고리즘 및 키 정보 (alg, kid)
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
	@ApiErrorResponse({ errorCode: ErrorCode.APPLE_0354 })
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

		return mapToAuthTokensResponse(result);
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

### 📦 필요한 라이브러리 (Expo)
\`\`\`bash
npx expo install expo-auth-session expo-crypto expo-web-browser expo-linking
\`\`\`

### 🔐 각 라이브러리가 필요한 이유

#### 1. expo-crypto - PKCE 및 CSRF 보안
**왜 필요한가?**
- **PKCE (Proof Key for Code Exchange)**: Authorization Code Interception Attack 방지
- **CSRF (Cross-Site Request Forgery)**: \`state\` 파라미터로 요청 위조 공격 방지
- 암호학적으로 안전한 난수 생성 (\`randomUUID()\`)

**보안적 이점:**
| 공격 유형 | expo-crypto 없이 | expo-crypto 사용 시 |
|----------|-----------------|-------------------|
| Code 가로채기 | ❌ 악성 앱이 Authorization Code 탈취 가능 | ✅ code_verifier 없이는 토큰 교환 불가 |
| CSRF 공격 | ❌ 공격자가 위조 요청 가능 | ✅ state 불일치로 요청 거부 |
| 세션 고정 | ❌ 공격자 세션 주입 가능 | ✅ 예측 불가능한 state로 방지 |

\`\`\`typescript
import * as Crypto from 'expo-crypto';
const state = Crypto.randomUUID(); // CSRF 방지 토큰
const codeVerifier = Crypto.randomUUID(); // PKCE용
\`\`\`

#### 2. expo-linking - 딥링크 및 콜백 URL 처리
**왜 필요한가?**
- OAuth 콜백 URL을 네이티브 앱으로 정확히 라우팅
- Custom URL Scheme 처리 (\`aido://auth/callback\`)
- Universal Links(iOS) / App Links(Android) 지원

**보안적 이점:**
| 기능 | 설명 |
|------|------|
| 정확한 앱 라우팅 | 콜백이 정확한 앱으로만 전달되도록 보장 |
| URL 파싱 | state, code 파라미터 안전하게 추출 |
| 토큰 보호 | URL에 토큰 직접 노출 방지 (code 교환 방식) |

\`\`\`typescript
import * as Linking from 'expo-linking';
const returnUrl = Linking.createURL('auth/callback', { scheme: 'aido' });
// 결과: aido://auth/callback

const parsed = Linking.parse(callbackUrl);
// parsed.queryParams.code, parsed.queryParams.state 추출
\`\`\`

#### 3. expo-web-browser - 보안 OAuth 브라우저 세션
**왜 필요한가?**
- **RFC 8252 (OAuth 2.0 for Native Apps) 준수**: 시스템 브라우저 사용 권장
- 인앱 WebView 대신 별도의 보안 브라우저에서 인증 진행
- 세션 쿠키, 자동 완성, 비밀번호 관리자 활용 가능

**WebView vs 시스템 브라우저 비교:**
| 항목 | 인앱 WebView | expo-web-browser |
|------|-------------|-----------------|
| 자격증명 접근 | ❌ 앱이 비밀번호 가로채기 가능 | ✅ 시스템이 보호 |
| 피싱 방지 | ❌ 주소창 위조 가능 | ✅ 시스템 주소창 표시 |
| 세션 재사용 | ❌ 매번 로그인 필요 | ✅ 기존 세션 활용 |
| 생체 인증 | ❌ 지원 불가 | ✅ Face ID/Touch ID |

\`\`\`typescript
import * as WebBrowser from 'expo-web-browser';

// 앱 시작 시 호출 (딥링크 처리 준비)
WebBrowser.maybeCompleteAuthSession();

// OAuth 브라우저 열기
const result = await WebBrowser.openAuthSessionAsync(authUrl, returnUrl);
\`\`\`

### 🔒 서버 측 토큰 검증이 필요한 이유

**왜 클라이언트가 보낸 profile을 그대로 신뢰하지 않는가?**

서버에서는 클라이언트가 보낸 Access Token으로 Google API를 **직접 호출**하여 사용자 정보를 검증합니다.

| 위협 | 클라이언트만 신뢰 시 | 서버 검증 시 |
|------|---------------------|-------------|
| 프로필 위조 | ❌ 다른 사용자로 사칭 가능 | ✅ Google API로 실제 정보 확인 |
| 토큰 위조 | ❌ 가짜 토큰으로 로그인 가능 | ✅ 유효하지 않은 토큰은 API 호출 실패 |
| 이메일 인증 우회 | ❌ verified_email 위조 가능 | ✅ Google이 반환한 값만 신뢰 |

**서버 검증 방식 (google-auth-library):**
\`\`\`typescript
// 서버에서 Access Token으로 사용자 정보 직접 조회
const userInfo = await axios.get(
  'https://www.googleapis.com/userinfo/v2/me',
  { headers: { Authorization: \`Bearer \${accessToken}\` } }
);
// Google이 반환한 정보만 신뢰
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
	@ApiErrorResponse({ errorCode: ErrorCode.GOOGLE_0403 })
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

		return mapToAuthTokensResponse(result);
	}

	// ============================================
	// Kakao 웹 OAuth (모바일 앱 브라우저 기반)
	// ============================================

	@Get("kakao/start")
	@Public()
	@ApiDoc({
		summary: "Kakao OAuth 시작 (웹 브라우저 기반)",
		description: `
## 🟡 Kakao OAuth 시작점 (웹 브라우저 기반)

모바일 앱 또는 웹에서 이 엔드포인트를 호출하면 카카오 로그인 페이지로 리다이렉트됩니다.
인증 완료 후 지정한 \`redirect_uri\`로 교환 코드와 함께 리다이렉트됩니다.

### 🔄 전체 플로우
\`\`\`
[현재] GET /auth/kakao/start?state=xxx&redirect_uri=xxx  → 카카오 로그인 페이지
[다음] GET /auth/kakao/web-callback                       → code 처리, 교환 코드 발급
[완료] {redirect_uri}?code=xxx&state=xxx                  → 클라이언트로 리다이렉트
\`\`\`

### 📱 모바일 앱에서 호출 방법
\`\`\`typescript
import * as WebBrowser from 'expo-web-browser';

// 딥링크로 리다이렉트 (기본값)
const result = await WebBrowser.openAuthSessionAsync(
  'https://api.aido.kr/v1/auth/kakao/start?state=random-state',
  'aido://auth/callback'
);

// 또는 redirect_uri 명시적 지정
const result = await WebBrowser.openAuthSessionAsync(
  'https://api.aido.kr/v1/auth/kakao/start?state=random-state&redirect_uri=aido://auth/callback',
  'aido://auth/callback'
);
\`\`\`

### 🌐 웹에서 호출 방법
\`\`\`typescript
// 웹 콜백 URL로 리다이렉트
window.location.href =
  'https://api.aido.kr/v1/auth/kakao/start?state=random-state&redirect_uri=https://aido.kr/auth/callback';
\`\`\`

### ✅ 허용된 Redirect URI
보안을 위해 다음 패턴의 URI만 허용됩니다:
- \`aido://auth/callback\` - 모바일 앱 딥링크 (기본값)
- \`https://aido.kr/*\` - aido.kr 도메인
- \`https://*.aido.kr/*\` - aido.kr 서브도메인
- \`http://localhost:*/*\` - 로컬 개발 환경

### 🔐 보안
- \`state\` 파라미터는 CSRF 방지용으로 클라이언트가 생성
- 콜백 시 동일한 state가 반환되는지 반드시 검증
- \`redirect_uri\`는 화이트리스트로 검증됨
		`,
	})
	@ApiQuery({
		name: "state",
		required: true,
		description: "CSRF 방지용 상태 값 (클라이언트가 생성한 랜덤 문자열)",
		example: "a1b2c3d4e5f6",
	})
	@ApiQuery({
		name: "redirect_uri",
		required: false,
		description: `인증 완료 후 리다이렉트될 URI.

**허용된 URI 패턴:**
- \`aido://auth/callback\` (기본값) - 모바일 앱
- \`https://aido.kr/*\` - 웹 프로덕션
- \`https://*.aido.kr/*\` - 서브도메인
- \`http://localhost:*/*\` - 로컬 개발

지정하지 않으면 기본값 \`aido://auth/callback\` 사용`,
		example: "aido://auth/callback",
	})
	async kakaoOAuthStart(
		@Query("state") state: string | undefined,
		@Query("redirect_uri") redirectUri: string | undefined,
		@Res() res: Response,
	): Promise<void> {
		// state가 없으면 서버에서 자동 생성
		const effectiveState = state || randomBytes(16).toString("hex");
		const authUrl = await this.oauthService.generateKakaoAuthUrlWithState(
			effectiveState,
			redirectUri,
		);
		res.redirect(authUrl);
	}

	@Get("kakao/web-callback")
	@Public()
	@ApiDoc({
		summary: "Kakao OAuth 콜백 (웹 브라우저 기반)",
		description: `
## 🟡 Kakao OAuth 콜백 (웹 브라우저 기반)

카카오 인증 완료 후 리다이렉트되는 콜백 엔드포인트입니다.
Authorization code를 처리하고, **일회용 교환 코드**를 발급하여
OAuth 시작 시 지정한 \`redirect_uri\`로 리다이렉트합니다.

### 🔐 보안 강화 (Exchange Code 패턴)
JWT 토큰이 URL에 직접 노출되지 않도록, 일회용 교환 코드만 클라이언트로 전달합니다.
클라이언트에서 \`POST /v1/auth/exchange\` 엔드포인트를 호출하여 실제 토큰을 획득합니다.

### 🔄 전체 플로우
\`\`\`
[1] GET /auth/kakao/start?state=xxx&redirect_uri=xxx  → 카카오 로그인 페이지로 리다이렉트
[2] GET /auth/kakao/web-callback                      → code 처리, 교환 코드 발급
[3] {redirect_uri}?code=xxx&state=xxx                 → 클라이언트로 리다이렉트
[4] POST /v1/auth/exchange { code: "xxx" }            → 토큰 교환
[5] { accessToken, refreshToken }                     → 클라이언트에서 토큰 저장
\`\`\`

### 📱 모바일 앱에서 처리
\`\`\`typescript
// aido://auth/callback?code=xxx&state=xxx 수신 후
const { code, state } = parseDeepLink(url);

// state 검증 후 토큰 교환
const response = await fetch('https://api.aido.kr/v1/auth/exchange', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code }),
});

const { accessToken, refreshToken } = await response.json();
\`\`\`

### 🌐 웹에서 처리
\`\`\`typescript
// https://aido.kr/auth/callback?code=xxx&state=xxx 수신 후
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const state = urlParams.get('state');

// state 검증 후 토큰 교환
const response = await fetch('https://api.aido.kr/v1/auth/exchange', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code }),
});

const { accessToken, refreshToken } = await response.json();
\`\`\`

### ⚠️ 에러 처리
- 인증 실패 시: \`{redirect_uri}?error=authentication_failed&error_description=...&state=xxx\`
- state 검증 실패 시: 클라이언트에서 에러 처리

### 🔒 참고
- 이 엔드포인트는 카카오에서 직접 호출됩니다 (사용자가 직접 호출하지 않음)
- \`redirect_uri\`는 OAuth 시작 시 DB에 저장된 값을 사용합니다
		`,
	})
	@ApiQuery({
		name: "code",
		required: true,
		description: "카카오에서 받은 authorization code",
	})
	@ApiQuery({
		name: "state",
		required: true,
		description: "CSRF 방지용 상태 값 (OAuth 시작 시 전달한 값과 동일)",
	})
	async kakaoOAuthCallback(
		@Query("code") code: string,
		@Query("state") state: string,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		// 기본 redirect_uri (state가 없거나 조회 실패 시 사용)
		const defaultRedirectUri = "aido://auth/callback";

		try {
			const metadata = this.extractMetadata(req);

			// 토큰 생성 + 교환 코드 발급 (토큰은 DB에 임시 저장)
			// OAuthState에서 redirect_uri도 함께 반환
			const result =
				await this.oauthService.handleKakaoWebCallbackWithExchangeCode(
					code,
					state,
					metadata,
				);

			// 성공 시 저장된 redirect_uri로 교환 코드 전달 (토큰 노출 방지)
			const redirectUri = result.redirectUri || defaultRedirectUri;
			const params = new URLSearchParams({
				code: result.exchangeCode,
				state,
			});

			res.redirect(`${redirectUri}?${params.toString()}`);
		} catch (error) {
			// 에러 시 기본 redirect_uri로 에러 정보 전달 (BusinessException인 경우 에러 코드 포함)
			const params = this.buildOAuthErrorParams(error, state);

			res.redirect(`${defaultRedirectUri}?${params.toString()}`);
		}
	}

	// ============================================
	// Google 웹 OAuth (웹 브라우저 기반)
	// ============================================

	@Get("google/start")
	@Public()
	@ApiDoc({
		summary: "Google OAuth 시작 (웹 브라우저 기반)",
		description: `
## 🔵 Google OAuth 시작점 (웹 브라우저 기반)

모바일 앱 또는 웹에서 이 엔드포인트를 호출하면 구글 로그인 페이지로 리다이렉트됩니다.
인증 완료 후 지정한 \`redirect_uri\`로 교환 코드와 함께 리다이렉트됩니다.

### 🔄 전체 플로우
\`\`\`
[현재] GET /auth/google/start?state=xxx&redirect_uri=xxx  → 구글 로그인 페이지
[다음] GET /auth/google/web-callback                      → code 처리, 교환 코드 발급
[완료] {redirect_uri}?code=xxx&state=xxx                  → 클라이언트로 리다이렉트
\`\`\`

### 📱 모바일 앱에서 호출 방법
\`\`\`typescript
import * as WebBrowser from 'expo-web-browser';

const result = await WebBrowser.openAuthSessionAsync(
  'https://api.aido.kr/v1/auth/google/start?state=random-state',
  'aido://auth/callback'
);
\`\`\`

### ✅ 허용된 Redirect URI
- \`aido://auth/callback\` - 모바일 앱 딥링크 (기본값)
- \`https://aido.kr/*\` - aido.kr 도메인
- \`https://*.aido.kr/*\` - aido.kr 서브도메인
- \`http://localhost:*/*\` - 로컬 개발 환경
		`,
	})
	@ApiQuery({
		name: "state",
		required: true,
		description: "CSRF 방지용 상태 값 (클라이언트가 생성한 랜덤 문자열)",
		example: "a1b2c3d4e5f6",
	})
	@ApiQuery({
		name: "redirect_uri",
		required: false,
		description: "인증 완료 후 리다이렉트될 URI. 기본값: aido://auth/callback",
		example: "aido://auth/callback",
	})
	async googleOAuthStart(
		@Query("state") state: string | undefined,
		@Query("redirect_uri") redirectUri: string | undefined,
		@Res() res: Response,
	): Promise<void> {
		const effectiveState = state || randomBytes(16).toString("hex");
		const authUrl = await this.oauthService.generateGoogleAuthUrlWithState(
			effectiveState,
			redirectUri,
		);
		res.redirect(authUrl);
	}

	@Get("google/web-callback")
	@Public()
	@ApiDoc({
		summary: "Google OAuth 콜백 (웹 브라우저 기반)",
		description: `
## 🔵 Google OAuth 콜백 (웹 브라우저 기반)

구글 인증 완료 후 리다이렉트되는 콜백 엔드포인트입니다.
Authorization code를 처리하고, **일회용 교환 코드**를 발급하여
OAuth 시작 시 지정한 \`redirect_uri\`로 리다이렉트합니다.

### 🔐 보안 강화 (Exchange Code 패턴)
JWT 토큰이 URL에 직접 노출되지 않도록, 일회용 교환 코드만 클라이언트로 전달합니다.
클라이언트에서 \`POST /v1/auth/exchange\` 엔드포인트를 호출하여 실제 토큰을 획득합니다.

### 🔄 전체 플로우
\`\`\`
[1] GET /auth/google/start?state=xxx&redirect_uri=xxx → 구글 로그인 페이지로 리다이렉트
[2] GET /auth/google/web-callback                     → code 처리, 교환 코드 발급
[3] {redirect_uri}?code=xxx&state=xxx                 → 클라이언트로 리다이렉트
[4] POST /v1/auth/exchange { code: "xxx" }            → 토큰 교환
[5] { accessToken, refreshToken }                     → 클라이언트에서 토큰 저장
\`\`\`
		`,
	})
	@ApiQuery({
		name: "code",
		required: true,
		description: "구글에서 받은 authorization code",
	})
	@ApiQuery({
		name: "state",
		required: true,
		description: "CSRF 방지용 상태 값 (OAuth 시작 시 전달한 값과 동일)",
	})
	async googleOAuthCallback(
		@Query("code") code: string,
		@Query("state") state: string,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		const defaultRedirectUri = "aido://auth/callback";

		try {
			const metadata = this.extractMetadata(req);

			const result =
				await this.oauthService.handleGoogleWebCallbackWithExchangeCode(
					code,
					state,
					metadata,
				);

			const redirectUri = result.redirectUri || defaultRedirectUri;
			const params = new URLSearchParams({
				code: result.exchangeCode,
				state,
			});

			res.redirect(`${redirectUri}?${params.toString()}`);
		} catch (error) {
			this.logger.error(
				`Google OAuth callback error: ${error instanceof Error ? error.message : String(error)}`,
				error instanceof Error ? error.stack : undefined,
			);
			const params = this.buildOAuthErrorParams(error, state);

			res.redirect(`${defaultRedirectUri}?${params.toString()}`);
		}
	}

	// ============================================
	// Naver 웹 OAuth (웹 브라우저 기반)
	// ============================================

	@Get("naver/start")
	@Public()
	@ApiDoc({
		summary: "Naver OAuth 시작 (웹 브라우저 기반)",
		description: `
## 🟢 Naver OAuth 시작점 (웹 브라우저 기반)

모바일 앱 또는 웹에서 이 엔드포인트를 호출하면 네이버 로그인 페이지로 리다이렉트됩니다.
인증 완료 후 지정한 \`redirect_uri\`로 교환 코드와 함께 리다이렉트됩니다.

### 🔄 전체 플로우
\`\`\`
[현재] GET /auth/naver/start?state=xxx&redirect_uri=xxx  → 네이버 로그인 페이지
[다음] GET /auth/naver/web-callback                      → code 처리, 교환 코드 발급
[완료] {redirect_uri}?code=xxx&state=xxx                 → 클라이언트로 리다이렉트
\`\`\`

### 📱 모바일 앱에서 호출 방법
\`\`\`typescript
import * as WebBrowser from 'expo-web-browser';

const result = await WebBrowser.openAuthSessionAsync(
  'https://api.aido.kr/v1/auth/naver/start?state=random-state',
  'aido://auth/callback'
);
\`\`\`

### ✅ 허용된 Redirect URI
- \`aido://auth/callback\` - 모바일 앱 딥링크 (기본값)
- \`https://aido.kr/*\` - aido.kr 도메인
- \`https://*.aido.kr/*\` - aido.kr 서브도메인
- \`http://localhost:*/*\` - 로컬 개발 환경
		`,
	})
	@ApiQuery({
		name: "state",
		required: true,
		description: "CSRF 방지용 상태 값 (클라이언트가 생성한 랜덤 문자열)",
		example: "a1b2c3d4e5f6",
	})
	@ApiQuery({
		name: "redirect_uri",
		required: false,
		description: "인증 완료 후 리다이렉트될 URI. 기본값: aido://auth/callback",
		example: "aido://auth/callback",
	})
	async naverOAuthStart(
		@Query("state") state: string | undefined,
		@Query("redirect_uri") redirectUri: string | undefined,
		@Res() res: Response,
	): Promise<void> {
		const effectiveState = state || randomBytes(16).toString("hex");
		const authUrl = await this.oauthService.generateNaverAuthUrlWithState(
			effectiveState,
			redirectUri,
		);
		res.redirect(authUrl);
	}

	@Get("naver/web-callback")
	@Public()
	@ApiDoc({
		summary: "Naver OAuth 콜백 (웹 브라우저 기반)",
		description: `
## 🟢 Naver OAuth 콜백 (웹 브라우저 기반)

네이버 인증 완료 후 리다이렉트되는 콜백 엔드포인트입니다.
Authorization code를 처리하고, **일회용 교환 코드**를 발급하여
OAuth 시작 시 지정한 \`redirect_uri\`로 리다이렉트합니다.

### 🔐 보안 강화 (Exchange Code 패턴)
JWT 토큰이 URL에 직접 노출되지 않도록, 일회용 교환 코드만 클라이언트로 전달합니다.
클라이언트에서 \`POST /v1/auth/exchange\` 엔드포인트를 호출하여 실제 토큰을 획득합니다.

### 🔄 전체 플로우
\`\`\`
[1] GET /auth/naver/start?state=xxx&redirect_uri=xxx → 네이버 로그인 페이지로 리다이렉트
[2] GET /auth/naver/web-callback                     → code 처리, 교환 코드 발급
[3] {redirect_uri}?code=xxx&state=xxx                → 클라이언트로 리다이렉트
[4] POST /v1/auth/exchange { code: "xxx" }           → 토큰 교환
[5] { accessToken, refreshToken }                    → 클라이언트에서 토큰 저장
\`\`\`
		`,
	})
	@ApiQuery({
		name: "code",
		required: true,
		description: "네이버에서 받은 authorization code",
	})
	@ApiQuery({
		name: "state",
		required: true,
		description: "CSRF 방지용 상태 값 (OAuth 시작 시 전달한 값과 동일)",
	})
	async naverOAuthCallback(
		@Query("code") code: string,
		@Query("state") state: string,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		const defaultRedirectUri = "aido://auth/callback";

		try {
			const metadata = this.extractMetadata(req);

			const result =
				await this.oauthService.handleNaverWebCallbackWithExchangeCode(
					code,
					state,
					metadata,
				);

			const redirectUri = result.redirectUri || defaultRedirectUri;
			const params = new URLSearchParams({
				code: result.exchangeCode,
				state,
			});

			res.redirect(`${redirectUri}?${params.toString()}`);
		} catch (error) {
			const params = this.buildOAuthErrorParams(error, state);

			res.redirect(`${defaultRedirectUri}?${params.toString()}`);
		}
	}

	// ============================================
	// Kakao 모바일 OAuth (기존 토큰 기반)
	// ============================================

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

### 📦 필요한 라이브러리 (Expo)
\`\`\`bash
npx expo install expo-auth-session expo-crypto expo-web-browser expo-linking
\`\`\`

### 🔐 각 라이브러리가 필요한 이유

#### 1. expo-crypto - PKCE 및 CSRF 보안
**왜 필요한가?**
- **PKCE (Proof Key for Code Exchange)**: 모바일 앱에서 Authorization Code가 탈취되어도 토큰 교환 불가
- **state 파라미터**: CSRF(Cross-Site Request Forgery) 공격 방지
- 암호학적으로 안전한 난수 생성으로 예측 불가능한 값 보장

**보안적 이점:**
| 공격 유형 | expo-crypto 없이 | expo-crypto 사용 시 |
|----------|-----------------|-------------------|
| Code 가로채기 | ❌ 악성 앱이 code 탈취 후 토큰 획득 | ✅ code_verifier 없이는 토큰 교환 불가 |
| CSRF 공격 | ❌ 공격자가 악의적 OAuth 요청 주입 | ✅ state 불일치로 즉시 거부 |
| 세션 고정 | ❌ 공격자 세션으로 사용자 연결 가능 | ✅ 랜덤 state로 세션 고정 불가 |

\`\`\`typescript
import * as Crypto from 'expo-crypto';
const state = Crypto.randomUUID(); // CSRF 토큰 - 콜백에서 반드시 검증
const codeVerifier = Crypto.randomUUID(); // PKCE용 - 토큰 교환 시 필요
\`\`\`

#### 2. expo-linking - 딥링크 및 콜백 URL 처리
**왜 필요한가?**
- Kakao OAuth 콜백 URL을 네이티브 앱으로 정확히 라우팅
- Custom URL Scheme 생성 및 파싱 (\`aido://auth/kakao/callback\`)
- Universal Links(iOS) / App Links(Android) 지원

**보안적 이점:**
| 기능 | 설명 |
|------|------|
| 정확한 앱 라우팅 | Kakao 인증 완료 후 정확한 앱으로만 콜백 전달 |
| URL 파싱 | code, state 파라미터를 안전하게 추출하여 검증 |
| 토큰 보호 | Access Token이 URL에 직접 노출되지 않음 (code 교환 방식) |

\`\`\`typescript
import * as Linking from 'expo-linking';
const returnUrl = Linking.createURL('auth/kakao/callback', { scheme: 'aido' });
// 결과: aido://auth/kakao/callback

// 콜백 URL에서 code와 state 추출
const parsed = Linking.parse(callbackUrl);
const { code, state: returnedState } = parsed.queryParams;
// state 검증 후 code로 토큰 교환
\`\`\`

#### 3. expo-web-browser - 보안 OAuth 브라우저 세션
**왜 필요한가?**
- **RFC 8252 준수**: 네이티브 앱에서는 시스템 브라우저 사용 권장
- 카카오 계정 로그인을 안전한 환경에서 진행
- 기존 카카오 로그인 세션 재사용으로 UX 향상

**WebView vs 시스템 브라우저 비교:**
| 항목 | 인앱 WebView | expo-web-browser |
|------|-------------|-----------------|
| 자격증명 접근 | ❌ 앱이 카카오 비밀번호 가로채기 가능 | ✅ 시스템이 보호 |
| 피싱 방지 | ❌ 가짜 카카오 로그인 UI 표시 가능 | ✅ 진짜 카카오 도메인 주소창 표시 |
| 세션 재사용 | ❌ 매번 카카오 로그인 필요 | ✅ 기존 카카오 로그인 세션 활용 |
| 카카오톡 연동 | ❌ 지원 불가 | ✅ 카카오톡 앱 인증 가능 |

\`\`\`typescript
import * as WebBrowser from 'expo-web-browser';

// 앱 시작 시 호출 - 딥링크로 돌아왔을 때 세션 정리
WebBrowser.maybeCompleteAuthSession();

// Kakao OAuth 브라우저 열기
const result = await WebBrowser.openAuthSessionAsync(kakaoAuthUrl, returnUrl);
\`\`\`

### 🔒 서버 측 Access Token 검증이 필요한 이유

**왜 클라이언트가 보낸 profile을 그대로 신뢰하지 않는가?**

서버에서는 클라이언트가 보낸 Access Token으로 Kakao API(\`/v2/user/me\`)를 **직접 호출**하여 검증합니다.

| 위협 | 클라이언트만 신뢰 시 | 서버 검증 시 |
|------|---------------------|-------------|
| 프로필 위조 | ❌ 타인의 카카오 ID로 사칭 가능 | ✅ Kakao API가 실제 토큰 소유자 반환 |
| 토큰 위조 | ❌ 가짜 토큰으로 로그인 시도 | ✅ Kakao API 호출 실패로 탐지 |
| 만료된 토큰 | ❌ 이전에 탈취한 토큰 재사용 | ✅ Kakao가 만료 토큰 거부 |
| 권한 확인 | ❌ 동의하지 않은 정보 조작 | ✅ Kakao가 실제 동의 범위 반환 |

**서버 검증 방식:**
\`\`\`typescript
// 서버에서 Access Token으로 Kakao API 직접 호출
const userInfo = await axios.get('https://kapi.kakao.com/v2/user/me', {
  headers: { Authorization: \`Bearer \${accessToken}\` }
});
// Kakao가 반환한 정보만 신뢰하여 사용자 생성/로그인 처리
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
	@ApiErrorResponse({ errorCode: ErrorCode.KAKAO_0308 })
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

		return mapToAuthTokensResponse(result);
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

### 📦 필요한 라이브러리 (Expo)
\`\`\`bash
npx expo install expo-auth-session expo-crypto expo-web-browser expo-linking
\`\`\`

### 🔐 각 라이브러리가 필요한 이유

#### 1. expo-crypto - PKCE 및 CSRF 보안
**왜 필요한가?**
- **state 파라미터 생성**: CSRF(Cross-Site Request Forgery) 공격 방지의 핵심
- 암호학적으로 안전한 난수 생성 (\`randomUUID()\`)
- 예측 불가능한 값으로 세션 고정 공격 방지

**보안적 이점:**
| 공격 유형 | expo-crypto 없이 | expo-crypto 사용 시 |
|----------|-----------------|-------------------|
| CSRF 공격 | ❌ 공격자가 악의적 OAuth 요청 주입 가능 | ✅ 랜덤 state 불일치로 즉시 거부 |
| 세션 고정 | ❌ 공격자 세션으로 사용자 연결 가능 | ✅ 예측 불가능한 state로 방지 |
| 리플레이 공격 | ❌ 이전 인증 요청 재사용 가능 | ✅ 일회성 state로 재사용 방지 |

\`\`\`typescript
import * as Crypto from 'expo-crypto';
// CSRF 방지 토큰 - 콜백에서 반드시 검증 필요!
const state = Crypto.randomUUID();
// 저장 후, 콜백에서 returnedState === state 검증
\`\`\`

#### 2. expo-linking - 딥링크 및 콜백 URL 처리
**왜 필요한가?**
- Naver OAuth 콜백 URL을 네이티브 앱으로 정확히 라우팅
- Custom URL Scheme 생성 및 파싱 (\`aido://auth/naver/callback\`)
- Universal Links(iOS) / App Links(Android) 지원

**보안적 이점:**
| 기능 | 설명 |
|------|------|
| 정확한 앱 라우팅 | Naver 인증 완료 후 정확한 앱으로만 콜백 전달 |
| URL 파싱 | code, state, error 파라미터를 안전하게 추출 |
| state 검증 | 저장된 state와 반환된 state 비교로 CSRF 방지 |

\`\`\`typescript
import * as Linking from 'expo-linking';
const returnUrl = Linking.createURL('auth/naver/callback', { scheme: 'aido' });
// 결과: aido://auth/naver/callback

// 콜백 URL에서 code와 state 추출
const parsed = Linking.parse(callbackUrl);
const { code, state: returnedState, error } = parsed.queryParams;

// 필수! state 검증
if (returnedState !== savedState) {
  throw new Error('CSRF attack detected!');
}
\`\`\`

#### 3. expo-web-browser - 보안 OAuth 브라우저 세션
**왜 필요한가?**
- **RFC 8252 준수**: 네이티브 앱에서는 시스템 브라우저 사용 권장
- 네이버 계정 로그인을 안전한 환경에서 진행
- 기존 네이버 로그인 세션 재사용으로 UX 향상

**WebView vs 시스템 브라우저 비교:**
| 항목 | 인앱 WebView | expo-web-browser |
|------|-------------|-----------------|
| 자격증명 접근 | ❌ 앱이 네이버 비밀번호 가로채기 가능 | ✅ 시스템이 보호 |
| 피싱 방지 | ❌ 가짜 네이버 로그인 UI 표시 가능 | ✅ 진짜 nid.naver.com 주소창 표시 |
| 세션 재사용 | ❌ 매번 네이버 로그인 필요 | ✅ 기존 네이버 로그인 세션 활용 |
| 2단계 인증 | ❌ 지원 불안정 | ✅ 네이버 앱 OTP 연동 가능 |

\`\`\`typescript
import * as WebBrowser from 'expo-web-browser';

// 앱 시작 시 호출 - 딥링크로 돌아왔을 때 세션 정리
WebBrowser.maybeCompleteAuthSession();

// Naver OAuth 브라우저 열기
const result = await WebBrowser.openAuthSessionAsync(naverAuthUrl, returnUrl);
\`\`\`

### 🔒 서버 측 검증 및 client_secret 보호가 필요한 이유

**Naver OAuth의 특수성: client_secret 필요**

Naver는 토큰 교환 시 \`client_secret\`이 필수입니다. 이 비밀키는 **절대로 클라이언트에 저장하면 안 됩니다**.

| 위치 | client_secret 노출 시 위험 |
|------|--------------------------|
| 모바일 앱 | ❌ 앱 디컴파일로 탈취 → 다른 앱이 우리 앱 사칭 가능 |
| 서버 | ✅ 환경변수로 안전하게 관리, 외부 접근 불가 |

**왜 클라이언트가 보낸 profile을 그대로 신뢰하지 않는가?**

서버에서는 클라이언트가 보낸 Access Token으로 Naver API(\`/v1/nid/me\`)를 **직접 호출**하여 검증합니다.

| 위협 | 클라이언트만 신뢰 시 | 서버 검증 시 |
|------|---------------------|-------------|
| 프로필 위조 | ❌ 타인의 네이버 ID로 사칭 가능 | ✅ Naver API가 실제 토큰 소유자 반환 |
| 토큰 위조 | ❌ 가짜 토큰으로 로그인 시도 | ✅ Naver API 호출 실패로 탐지 |
| 만료된 토큰 | ❌ 이전에 탈취한 토큰 재사용 | ✅ Naver가 만료 토큰 거부 |
| 권한 확인 | ❌ 동의하지 않은 정보 조작 | ✅ Naver가 실제 동의 범위 반환 |

**서버 검증 방식:**
\`\`\`typescript
// 서버에서 Access Token으로 Naver API 직접 호출
const userInfo = await axios.get('https://openapi.naver.com/v1/nid/me', {
  headers: { Authorization: \`Bearer \${accessToken}\` }
});
// Naver가 반환한 response.id, response.email 등만 신뢰
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
	@ApiErrorResponse({ errorCode: ErrorCode.NAVER_0453 })
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

		return mapToAuthTokensResponse(result);
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
	@ApiErrorResponse({ errorCode: ErrorCode.APPLE_0355 })
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
	@ApiErrorResponse({ errorCode: ErrorCode.USER_0610 })
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
