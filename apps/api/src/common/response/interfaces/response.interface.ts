/**
 * API 공통 응답 타입
 */

/**
 * 기본 응답 인터페이스
 */
export interface BaseResponse {
	success: boolean;
	timestamp: number;
}

/**
 * 성공 응답 인터페이스
 */
export interface SuccessResponse<T = unknown> extends BaseResponse {
	success: true;
	data: T;
}
