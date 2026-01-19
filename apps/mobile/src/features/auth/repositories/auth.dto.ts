import type { AuthTokens, CurrentUser } from '@aido/validators';
import type { ApiResponse } from '@src/core/api';

// ============ API Response DTOs ============

/** 토큰 교환 응답 */
export type ExchangeCodeResponseDto = ApiResponse<AuthTokens>;

/** 현재 사용자 조회 응답 */
export type GetCurrentUserResponseDto = ApiResponse<CurrentUser>;
