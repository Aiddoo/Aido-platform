/**
 * Swagger HTTP 상태 코드별 기본 설명
 */
export const SWAGGER_DESCRIPTION = {
	SUCCESS_200: "요청이 성공적으로 처리되었습니다",
	CREATED_201: "리소스가 성공적으로 생성되었습니다",
	NO_CONTENT_204: "요청이 성공적으로 처리되었습니다 (응답 본문 없음)",
	BAD_REQUEST_400: "잘못된 요청입니다",
	UNAUTHORIZED_401: "인증이 필요합니다",
	FORBIDDEN_403: "접근 권한이 없습니다",
	NOT_FOUND_404: "리소스를 찾을 수 없습니다",
	CONFLICT_409: "리소스 충돌이 발생했습니다",
	UNPROCESSABLE_ENTITY_422: "요청을 처리할 수 없습니다",
	TOO_MANY_REQUESTS_429: "요청이 너무 많습니다",
	INTERNAL_ERROR_500: "서버 내부 오류가 발생했습니다",
} as const;

export type SwaggerDescription =
	(typeof SWAGGER_DESCRIPTION)[keyof typeof SWAGGER_DESCRIPTION];

/**
 * Swagger 보안 스키마 이름
 */
export const SWAGGER_SECURITY = {
	ACCESS_TOKEN: "access-token",
	REFRESH_TOKEN: "refresh-token",
} as const;

/**
 * 공통 에러 응답에 포함할 HTTP 상태 코드
 */
export const COMMON_ERROR_STATUS_CODES = [400, 500] as const;
