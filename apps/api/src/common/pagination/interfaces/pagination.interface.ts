import type { SortOrder } from "../constants/pagination.constant";

// ============================================
// 오프셋 기반 페이지네이션
// ============================================

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
// 커서 기반 페이지네이션 (제네릭)
// ============================================

/**
 * 커서 타입
 * - string: CUID, UUID 등 문자열 기반 ID
 * - number: auto-increment 등 숫자 기반 ID
 */
export type CursorType = string | number;

/**
 * 커서 기반 페이지네이션 입력 파라미터
 */
export interface CursorPaginationParams<T extends CursorType = string> {
	cursor?: T;
	size?: number;
}

/**
 * 커서 기반 페이지네이션 정보
 */
export interface CursorPaginationInfo<T extends CursorType = string> {
	nextCursor: T | null;
	hasNext: boolean;
	size: number;
}

/**
 * 커서 기반 페이지네이션 응답
 */
export interface CursorPaginatedResponse<
	TItem,
	TCursor extends CursorType = string,
> {
	items: TItem[];
	pagination: CursorPaginationInfo<TCursor>;
}

/**
 * 정규화된 커서 페이지네이션 파라미터
 */
export interface NormalizedCursorPagination<T extends CursorType = string> {
	cursor: T | undefined;
	size: number;
	take: number;
}

// ============================================
// 타입 별칭 (편의성)
// ============================================

/** String 커서 페이지네이션 (CUID, UUID 등) */
export type StringCursorPaginationParams = CursorPaginationParams<string>;
export type StringCursorPaginationInfo = CursorPaginationInfo<string>;
export type StringCursorPaginatedResponse<T> = CursorPaginatedResponse<
	T,
	string
>;

/** Number 커서 페이지네이션 (auto-increment) */
export type NumberCursorPaginationParams = CursorPaginationParams<number>;
export type NumberCursorPaginationInfo = CursorPaginationInfo<number>;
export type NumberCursorPaginatedResponse<T> = CursorPaginatedResponse<
	T,
	number
>;
