import { Injectable } from "@nestjs/common";
import {
	PAGINATION_DEFAULT,
	SORT_DEFAULT,
	type SortOrder,
} from "../constants/pagination.constant";
import type {
	CursorPaginatedResponse,
	CursorPaginationInfo,
	CursorPaginationParams,
	NormalizedPagination,
	PaginatedResponse,
	PaginationInfo,
	PaginationParams,
	SortParams,
} from "../interfaces/pagination.interface";

/**
 * 페이지네이션 서비스
 */
@Injectable()
export class PaginationService {
	/**
	 * 페이지네이션 정보 생성
	 */
	createPaginationInfo(params: {
		page: number;
		size: number;
		total: number;
	}): PaginationInfo {
		const { page, size, total } = params;
		const totalPages = Math.ceil(total / size);

		return {
			page,
			size,
			total,
			totalPages,
			hasNext: page < totalPages,
			hasPrevious: page > 1,
		};
	}

	/**
	 * 페이지네이션 응답 생성
	 */
	createPaginatedResponse<T>(params: {
		items: T[];
		page: number;
		size: number;
		total: number;
	}): PaginatedResponse<T> {
		const { items, page, size, total } = params;

		return {
			items,
			pagination: this.createPaginationInfo({ page, size, total }),
		};
	}

	/**
	 * 페이지네이션 파라미터 정규화
	 */
	normalizePagination(params: PaginationParams): NormalizedPagination {
		const page = Math.max(1, params.page || PAGINATION_DEFAULT.PAGE);
		const size = Math.min(
			PAGINATION_DEFAULT.MAX_SIZE,
			Math.max(
				PAGINATION_DEFAULT.MIN_SIZE,
				params.size || PAGINATION_DEFAULT.SIZE,
			),
		);

		return {
			page,
			size,
			skip: (page - 1) * size,
			take: size,
		};
	}

	/**
	 * 정렬 조건 정규화
	 */
	normalizeSortOrder(
		params: SortParams & { allowedFields?: string[] },
	): Record<string, SortOrder> {
		const { sortBy, sortOrder, allowedFields = [] } = params;

		const normalizedSortBy =
			sortBy && allowedFields.includes(sortBy)
				? sortBy
				: allowedFields[0] || SORT_DEFAULT.FIELD;

		const normalizedSortOrder: SortOrder = sortOrder === "ASC" ? "ASC" : "DESC";

		return {
			[normalizedSortBy]: normalizedSortOrder,
		};
	}

	// ============================================
	// 커서 기반 페이지네이션
	// ============================================

	/**
	 * 커서 기반 페이지네이션 파라미터 정규화
	 */
	normalizeCursorPagination(params: CursorPaginationParams): {
		cursor: string | undefined;
		size: number;
		take: number;
	} {
		const size = Math.min(
			PAGINATION_DEFAULT.MAX_SIZE,
			Math.max(
				PAGINATION_DEFAULT.MIN_SIZE,
				params.size || PAGINATION_DEFAULT.SIZE,
			),
		);

		return {
			cursor: params.cursor,
			size,
			take: size + 1, // 다음 페이지 존재 여부 확인을 위해 1개 더 가져옴
		};
	}

	/**
	 * 커서 기반 페이지네이션 정보 생성
	 */
	createCursorPaginationInfo<T extends { id: string }>(params: {
		items: T[];
		size: number;
		cursor?: string;
	}): CursorPaginationInfo {
		const { items, size, cursor } = params;
		const hasNext = items.length > size;
		const hasPrevious = cursor !== undefined;

		// 다음 페이지 존재 확인을 위해 가져온 추가 아이템 제거 후 커서 계산
		const actualItems = hasNext ? items.slice(0, size) : items;
		const lastItem = actualItems[actualItems.length - 1];
		const firstItem = actualItems[0];

		return {
			nextCursor: hasNext && lastItem ? lastItem.id : null,
			prevCursor: hasPrevious && firstItem ? firstItem.id : null,
			hasNext,
			hasPrevious,
			size,
		};
	}

	/**
	 * 커서 기반 페이지네이션 응답 생성
	 */
	createCursorPaginatedResponse<T extends { id: string }>(params: {
		items: T[];
		size: number;
		cursor?: string;
	}): CursorPaginatedResponse<T> {
		const { items, size, cursor } = params;
		const hasNext = items.length > size;

		// 다음 페이지 확인용 추가 아이템 제거
		const actualItems = hasNext ? items.slice(0, size) : items;

		return {
			items: actualItems,
			pagination: this.createCursorPaginationInfo({ items, size, cursor }),
		};
	}
}

/**
 * 페이지네이션 유틸리티 (정적 메서드)
 * 서비스 주입이 불가능한 경우 사용
 */
export class PaginationUtil {
	/**
	 * 페이지네이션 정보 생성
	 */
	static createPaginationInfo(params: {
		page: number;
		size: number;
		total: number;
	}): PaginationInfo {
		const { page, size, total } = params;
		const totalPages = Math.ceil(total / size);

		return {
			page,
			size,
			total,
			totalPages,
			hasNext: page < totalPages,
			hasPrevious: page > 1,
		};
	}

	/**
	 * 페이지네이션 응답 생성
	 */
	static createPaginatedResponse<T>(params: {
		items: T[];
		page: number;
		size: number;
		total: number;
	}): PaginatedResponse<T> {
		const { items, page, size, total } = params;

		return {
			items,
			pagination: this.createPaginationInfo({ page, size, total }),
		};
	}

	/**
	 * 페이지네이션 파라미터 정규화
	 */
	static normalizePagination(params: PaginationParams): NormalizedPagination {
		const page = Math.max(1, params.page || PAGINATION_DEFAULT.PAGE);
		const size = Math.min(
			PAGINATION_DEFAULT.MAX_SIZE,
			Math.max(
				PAGINATION_DEFAULT.MIN_SIZE,
				params.size || PAGINATION_DEFAULT.SIZE,
			),
		);

		return {
			page,
			size,
			skip: (page - 1) * size,
			take: size,
		};
	}

	/**
	 * 정렬 조건 정규화
	 */
	static normalizeSortOrder(
		params: SortParams & { allowedFields?: string[] },
	): Record<string, SortOrder> {
		const { sortBy, sortOrder, allowedFields = [] } = params;

		const normalizedSortBy =
			sortBy && allowedFields.includes(sortBy)
				? sortBy
				: allowedFields[0] || SORT_DEFAULT.FIELD;

		const normalizedSortOrder: SortOrder = sortOrder === "ASC" ? "ASC" : "DESC";

		return {
			[normalizedSortBy]: normalizedSortOrder,
		};
	}

	// ============================================
	// 커서 기반 페이지네이션
	// ============================================

	/**
	 * 커서 기반 페이지네이션 파라미터 정규화
	 */
	static normalizeCursorPagination(params: CursorPaginationParams): {
		cursor: string | undefined;
		size: number;
		take: number;
	} {
		const size = Math.min(
			PAGINATION_DEFAULT.MAX_SIZE,
			Math.max(
				PAGINATION_DEFAULT.MIN_SIZE,
				params.size || PAGINATION_DEFAULT.SIZE,
			),
		);

		return {
			cursor: params.cursor,
			size,
			take: size + 1,
		};
	}

	/**
	 * 커서 기반 페이지네이션 정보 생성
	 */
	static createCursorPaginationInfo<T extends { id: string }>(params: {
		items: T[];
		size: number;
		cursor?: string;
	}): CursorPaginationInfo {
		const { items, size, cursor } = params;
		const hasNext = items.length > size;
		const hasPrevious = cursor !== undefined;

		const actualItems = hasNext ? items.slice(0, size) : items;
		const lastItem = actualItems[actualItems.length - 1];
		const firstItem = actualItems[0];

		return {
			nextCursor: hasNext && lastItem ? lastItem.id : null,
			prevCursor: hasPrevious && firstItem ? firstItem.id : null,
			hasNext,
			hasPrevious,
			size,
		};
	}

	/**
	 * 커서 기반 페이지네이션 응답 생성
	 */
	static createCursorPaginatedResponse<T extends { id: string }>(params: {
		items: T[];
		size: number;
		cursor?: string;
	}): CursorPaginatedResponse<T> {
		const { items, size, cursor } = params;
		const hasNext = items.length > size;

		const actualItems = hasNext ? items.slice(0, size) : items;

		return {
			items: actualItems,
			pagination: this.createCursorPaginationInfo({ items, size, cursor }),
		};
	}
}
