import { HttpStatus } from "@nestjs/common";

/**
 * 비즈니스 에러 코드 정의
 * 소셜 로그인(카카오, 애플) 및 JWT 인증 지원
 */
export const ERROR_CODE = {
	// =========================================================================
	// 공통 (Common)
	// =========================================================================
	USER_NOT_FOUND: "USER_NOT_FOUND",
	TODO_NOT_FOUND: "TODO_NOT_FOUND",
	INVALID_PARAMETER: "INVALID_PARAMETER",
	INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",

	// =========================================================================
	// 동시성 관련 (Concurrency)
	// =========================================================================
	OPTIMISTIC_LOCK_ERROR: "OPTIMISTIC_LOCK_ERROR",
	CONCURRENT_MODIFICATION: "CONCURRENT_MODIFICATION",

	// =========================================================================
	// JWT 인증 관련 (JWT Authentication)
	// =========================================================================
	INVALID_TOKEN: "INVALID_TOKEN",
	TOKEN_EXPIRED: "TOKEN_EXPIRED",
	TOKEN_MALFORMED: "TOKEN_MALFORMED",
	REFRESH_TOKEN_INVALID: "REFRESH_TOKEN_INVALID",
	REFRESH_TOKEN_EXPIRED: "REFRESH_TOKEN_EXPIRED",
	TOKEN_REVOKED: "TOKEN_REVOKED",
	AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED",
	UNAUTHORIZED_ACCESS: "UNAUTHORIZED_ACCESS",

	// =========================================================================
	// 소셜 로그인 공통 (Social Login Common)
	// =========================================================================
	SOCIAL_AUTH_FAILED: "SOCIAL_AUTH_FAILED",
	SOCIAL_TOKEN_INVALID: "SOCIAL_TOKEN_INVALID",
	SOCIAL_PROVIDER_ERROR: "SOCIAL_PROVIDER_ERROR",
	SOCIAL_EMAIL_NOT_PROVIDED: "SOCIAL_EMAIL_NOT_PROVIDED",
	SOCIAL_ACCOUNT_NOT_LINKED: "SOCIAL_ACCOUNT_NOT_LINKED",

	// =========================================================================
	// 카카오 로그인 (Kakao Login)
	// =========================================================================
	KAKAO_AUTH_CODE_INVALID: "KAKAO_AUTH_CODE_INVALID",
	KAKAO_TOKEN_REQUEST_FAILED: "KAKAO_TOKEN_REQUEST_FAILED",
	KAKAO_USER_INFO_FAILED: "KAKAO_USER_INFO_FAILED",
	KAKAO_ACCOUNT_ALREADY_LINKED: "KAKAO_ACCOUNT_ALREADY_LINKED",
	KAKAO_UNLINK_FAILED: "KAKAO_UNLINK_FAILED",

	// =========================================================================
	// 애플 로그인 (Apple Login)
	// =========================================================================
	APPLE_ID_TOKEN_INVALID: "APPLE_ID_TOKEN_INVALID",
	APPLE_AUTH_CODE_INVALID: "APPLE_AUTH_CODE_INVALID",
	APPLE_TOKEN_VERIFICATION_FAILED: "APPLE_TOKEN_VERIFICATION_FAILED",
	APPLE_ACCOUNT_ALREADY_LINKED: "APPLE_ACCOUNT_ALREADY_LINKED",
	APPLE_UNLINK_FAILED: "APPLE_UNLINK_FAILED",
	APPLE_REVOKE_TOKEN_FAILED: "APPLE_REVOKE_TOKEN_FAILED",

	// =========================================================================
	// 이메일 인증 (Email Authentication)
	// =========================================================================
	EMAIL_ALREADY_REGISTERED: "EMAIL_ALREADY_REGISTERED",
	EMAIL_NOT_FOUND: "EMAIL_NOT_FOUND",
	EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",
	EMAIL_VERIFICATION_CODE_INVALID: "EMAIL_VERIFICATION_CODE_INVALID",
	EMAIL_VERIFICATION_CODE_EXPIRED: "EMAIL_VERIFICATION_CODE_EXPIRED",
	EMAIL_SEND_FAILED: "EMAIL_SEND_FAILED",
	INVALID_PASSWORD: "INVALID_PASSWORD",
	PASSWORD_MISMATCH: "PASSWORD_MISMATCH",

	// =========================================================================
	// 계정 관련 (Account)
	// =========================================================================
	ACCOUNT_ALREADY_EXISTS: "ACCOUNT_ALREADY_EXISTS",
	ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED",
	ACCOUNT_DELETED: "ACCOUNT_DELETED",
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

/**
 * 에러 메시지 매핑
 */
export const ERROR_MESSAGE: Record<ErrorCode, string> = {
	// 공통
	[ERROR_CODE.USER_NOT_FOUND]: "사용자를 찾을 수 없습니다.",
	[ERROR_CODE.TODO_NOT_FOUND]: "Todo를 찾을 수 없습니다.",
	[ERROR_CODE.INVALID_PARAMETER]: "잘못된 파라미터입니다.",
	[ERROR_CODE.INTERNAL_SERVER_ERROR]: "서버 내부 오류가 발생했습니다.",

	// 동시성 관련
	[ERROR_CODE.OPTIMISTIC_LOCK_ERROR]:
		"데이터가 다른 사용자에 의해 수정되었습니다. 다시 시도해주세요.",
	[ERROR_CODE.CONCURRENT_MODIFICATION]:
		"동시 수정으로 인한 충돌이 발생했습니다. 다시 시도해주세요.",

	// JWT 인증 관련
	[ERROR_CODE.INVALID_TOKEN]: "유효하지 않은 토큰입니다.",
	[ERROR_CODE.TOKEN_EXPIRED]: "토큰이 만료되었습니다.",
	[ERROR_CODE.TOKEN_MALFORMED]: "잘못된 형식의 토큰입니다.",
	[ERROR_CODE.REFRESH_TOKEN_INVALID]: "유효하지 않은 리프레시 토큰입니다.",
	[ERROR_CODE.REFRESH_TOKEN_EXPIRED]:
		"리프레시 토큰이 만료되었습니다. 다시 로그인해주세요.",
	[ERROR_CODE.TOKEN_REVOKED]: "폐기된 토큰입니다. 다시 로그인해주세요.",
	[ERROR_CODE.AUTHENTICATION_REQUIRED]: "인증이 필요합니다.",
	[ERROR_CODE.UNAUTHORIZED_ACCESS]: "접근 권한이 없습니다.",

	// 소셜 로그인 공통
	[ERROR_CODE.SOCIAL_AUTH_FAILED]: "소셜 로그인에 실패했습니다.",
	[ERROR_CODE.SOCIAL_TOKEN_INVALID]: "소셜 인증 토큰이 유효하지 않습니다.",
	[ERROR_CODE.SOCIAL_PROVIDER_ERROR]: "소셜 서비스 연결에 문제가 발생했습니다.",
	[ERROR_CODE.SOCIAL_EMAIL_NOT_PROVIDED]:
		"소셜 계정에서 이메일 정보를 가져올 수 없습니다.",
	[ERROR_CODE.SOCIAL_ACCOUNT_NOT_LINKED]: "연동된 소셜 계정이 없습니다.",

	// 카카오 로그인
	[ERROR_CODE.KAKAO_AUTH_CODE_INVALID]: "카카오 인증 코드가 유효하지 않습니다.",
	[ERROR_CODE.KAKAO_TOKEN_REQUEST_FAILED]: "카카오 토큰 요청에 실패했습니다.",
	[ERROR_CODE.KAKAO_USER_INFO_FAILED]:
		"카카오 사용자 정보를 가져오는데 실패했습니다.",
	[ERROR_CODE.KAKAO_ACCOUNT_ALREADY_LINKED]:
		"이미 다른 계정에 연동된 카카오 계정입니다.",
	[ERROR_CODE.KAKAO_UNLINK_FAILED]: "카카오 계정 연동 해제에 실패했습니다.",

	// 애플 로그인
	[ERROR_CODE.APPLE_ID_TOKEN_INVALID]: "애플 ID 토큰이 유효하지 않습니다.",
	[ERROR_CODE.APPLE_AUTH_CODE_INVALID]: "애플 인증 코드가 유효하지 않습니다.",
	[ERROR_CODE.APPLE_TOKEN_VERIFICATION_FAILED]:
		"애플 토큰 검증에 실패했습니다.",
	[ERROR_CODE.APPLE_ACCOUNT_ALREADY_LINKED]:
		"이미 다른 계정에 연동된 애플 계정입니다.",
	[ERROR_CODE.APPLE_UNLINK_FAILED]: "애플 계정 연동 해제에 실패했습니다.",
	[ERROR_CODE.APPLE_REVOKE_TOKEN_FAILED]: "애플 로그아웃 처리에 실패했습니다.",

	// 이메일 인증
	[ERROR_CODE.EMAIL_ALREADY_REGISTERED]: "이미 등록된 이메일입니다.",
	[ERROR_CODE.EMAIL_NOT_FOUND]: "등록되지 않은 이메일입니다.",
	[ERROR_CODE.EMAIL_NOT_VERIFIED]: "이메일 인증이 완료되지 않았습니다.",
	[ERROR_CODE.EMAIL_VERIFICATION_CODE_INVALID]:
		"인증 코드가 올바르지 않습니다.",
	[ERROR_CODE.EMAIL_VERIFICATION_CODE_EXPIRED]: "인증 코드가 만료되었습니다.",
	[ERROR_CODE.EMAIL_SEND_FAILED]: "이메일 발송에 실패했습니다.",
	[ERROR_CODE.INVALID_PASSWORD]: "비밀번호가 올바르지 않습니다.",
	[ERROR_CODE.PASSWORD_MISMATCH]: "비밀번호가 일치하지 않습니다.",

	// 계정 관련
	[ERROR_CODE.ACCOUNT_ALREADY_EXISTS]: "이미 가입된 계정입니다.",
	[ERROR_CODE.ACCOUNT_SUSPENDED]: "정지된 계정입니다. 고객센터에 문의해주세요.",
	[ERROR_CODE.ACCOUNT_DELETED]: "탈퇴한 계정입니다.",
};

/**
 * 에러 코드별 HTTP 상태 코드 매핑
 */
export const ERROR_HTTP_STATUS: Partial<Record<ErrorCode, HttpStatus>> = {
	// 404 NOT_FOUND
	[ERROR_CODE.USER_NOT_FOUND]: HttpStatus.NOT_FOUND,
	[ERROR_CODE.TODO_NOT_FOUND]: HttpStatus.NOT_FOUND,
	[ERROR_CODE.EMAIL_NOT_FOUND]: HttpStatus.NOT_FOUND,

	// 401 UNAUTHORIZED
	[ERROR_CODE.INVALID_TOKEN]: HttpStatus.UNAUTHORIZED,
	[ERROR_CODE.TOKEN_EXPIRED]: HttpStatus.UNAUTHORIZED,
	[ERROR_CODE.TOKEN_MALFORMED]: HttpStatus.UNAUTHORIZED,
	[ERROR_CODE.REFRESH_TOKEN_INVALID]: HttpStatus.UNAUTHORIZED,
	[ERROR_CODE.REFRESH_TOKEN_EXPIRED]: HttpStatus.UNAUTHORIZED,
	[ERROR_CODE.TOKEN_REVOKED]: HttpStatus.UNAUTHORIZED,
	[ERROR_CODE.AUTHENTICATION_REQUIRED]: HttpStatus.UNAUTHORIZED,
	[ERROR_CODE.SOCIAL_AUTH_FAILED]: HttpStatus.UNAUTHORIZED,
	[ERROR_CODE.SOCIAL_TOKEN_INVALID]: HttpStatus.UNAUTHORIZED,
	[ERROR_CODE.KAKAO_AUTH_CODE_INVALID]: HttpStatus.UNAUTHORIZED,
	[ERROR_CODE.KAKAO_TOKEN_REQUEST_FAILED]: HttpStatus.UNAUTHORIZED,
	[ERROR_CODE.APPLE_ID_TOKEN_INVALID]: HttpStatus.UNAUTHORIZED,
	[ERROR_CODE.APPLE_AUTH_CODE_INVALID]: HttpStatus.UNAUTHORIZED,
	[ERROR_CODE.APPLE_TOKEN_VERIFICATION_FAILED]: HttpStatus.UNAUTHORIZED,
	[ERROR_CODE.INVALID_PASSWORD]: HttpStatus.UNAUTHORIZED,
	[ERROR_CODE.EMAIL_NOT_VERIFIED]: HttpStatus.UNAUTHORIZED,
	[ERROR_CODE.EMAIL_VERIFICATION_CODE_INVALID]: HttpStatus.UNAUTHORIZED,
	[ERROR_CODE.EMAIL_VERIFICATION_CODE_EXPIRED]: HttpStatus.UNAUTHORIZED,

	// 403 FORBIDDEN
	[ERROR_CODE.UNAUTHORIZED_ACCESS]: HttpStatus.FORBIDDEN,
	[ERROR_CODE.ACCOUNT_SUSPENDED]: HttpStatus.FORBIDDEN,

	// 409 CONFLICT
	[ERROR_CODE.OPTIMISTIC_LOCK_ERROR]: HttpStatus.CONFLICT,
	[ERROR_CODE.CONCURRENT_MODIFICATION]: HttpStatus.CONFLICT,
	[ERROR_CODE.ACCOUNT_ALREADY_EXISTS]: HttpStatus.CONFLICT,
	[ERROR_CODE.EMAIL_ALREADY_REGISTERED]: HttpStatus.CONFLICT,
	[ERROR_CODE.KAKAO_ACCOUNT_ALREADY_LINKED]: HttpStatus.CONFLICT,
	[ERROR_CODE.APPLE_ACCOUNT_ALREADY_LINKED]: HttpStatus.CONFLICT,

	// 410 GONE
	[ERROR_CODE.ACCOUNT_DELETED]: HttpStatus.GONE,

	// 502 BAD_GATEWAY
	[ERROR_CODE.SOCIAL_PROVIDER_ERROR]: HttpStatus.BAD_GATEWAY,
	[ERROR_CODE.KAKAO_USER_INFO_FAILED]: HttpStatus.BAD_GATEWAY,
	[ERROR_CODE.KAKAO_UNLINK_FAILED]: HttpStatus.BAD_GATEWAY,
	[ERROR_CODE.APPLE_UNLINK_FAILED]: HttpStatus.BAD_GATEWAY,
	[ERROR_CODE.APPLE_REVOKE_TOKEN_FAILED]: HttpStatus.BAD_GATEWAY,
	[ERROR_CODE.EMAIL_SEND_FAILED]: HttpStatus.BAD_GATEWAY,

	// 500 INTERNAL_SERVER_ERROR
	[ERROR_CODE.INTERNAL_SERVER_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
};
