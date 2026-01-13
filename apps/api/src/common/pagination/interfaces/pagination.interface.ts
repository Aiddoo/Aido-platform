import type { SortOrder } from "../constants/pagination.constant";

/**
 * 페이지네이션 정보
 */
export interface PaginationInfo {
	page: number;
	size: number;
	total: number;
	totalPages: number;
	hasNext: boolean;
	hasPrevious: boolean;
}

/**
 * 페이지네이션 응답
 */
export interface PaginatedResponse<T> {
	items: T[];
	pagination: PaginationInfo;
}

/**
 * 페이지네이션 입력 파라미터
 */
export interface PaginationParams {
	page?: number;
	size?: number;
}

/**
 * 정규화된 페이지네이션 파라미터
 */
export interface NormalizedPagination {
	page: number;
	size: number;
	skip: number;
	take: number;
}

/**
 * 정렬 파라미터
 */
export interface SortParams {
	sortBy?: string;
	sortOrder?: SortOrder;
}

// ============================================
// 커서 기반 페이지네이션
// ============================================

/**
 * 커서 기반 페이지네이션 입력 파라미터
 */
export interface CursorPaginationParams {
	cursor?: string;
	size?: number;
}

/**
 * 커서 기반 페이지네이션 정보
 */
export interface CursorPaginationInfo {
	nextCursor: string | null;
	prevCursor: string | null;
	hasNext: boolean;
	hasPrevious: boolean;
	size: number;
}

/**
 * 커서 기반 페이지네이션 응답
 */
export interface CursorPaginatedResponse<T> {
	items: T[];
	pagination: CursorPaginationInfo;
}
