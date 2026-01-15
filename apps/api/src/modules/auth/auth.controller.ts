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
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
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
	AuthTokensDto,
	ChangePasswordDto,
	CurrentUserDto,
	ForgotPasswordDto,
	LoginDto,
	MessageResponseDto,
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
	constructor(private readonly authService: AuthService) {}

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
