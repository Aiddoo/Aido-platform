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
	CursorType,
	NormalizedCursorPagination,
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
	// ============================================
	// 오프셋 기반 페이지네이션
	// ============================================

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
		const page = Math.max(1, params.page ?? PAGINATION_DEFAULT.PAGE);
		const size = Math.min(
			PAGINATION_DEFAULT.MAX_SIZE,
			Math.max(
				PAGINATION_DEFAULT.MIN_SIZE,
				params.size ?? PAGINATION_DEFAULT.SIZE,
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
				: (allowedFields[0] ?? SORT_DEFAULT.FIELD);

		const normalizedSortOrder: SortOrder = sortOrder === "ASC" ? "ASC" : "DESC";

		return {
			[normalizedSortBy]: normalizedSortOrder,
		};
	}

	// ============================================
	// 커서 기반 페이지네이션 (제네릭)
	// ============================================

	/**
	 * 커서 기반 페이지네이션 파라미터 정규화
	 * @template T - 커서 타입 (string | number)
	 */
	normalizeCursorPagination<T extends CursorType>(
		params: CursorPaginationParams<T>,
	): NormalizedCursorPagination<T> {
		const size = Math.min(
			PAGINATION_DEFAULT.MAX_SIZE,
			Math.max(
				PAGINATION_DEFAULT.MIN_SIZE,
				params.size ?? PAGINATION_DEFAULT.SIZE,
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
	 * @template TItem - 아이템 타입 (id 필드 필수)
	 * @template TCursor - 커서 타입 (string | number)
	 */
	createCursorPaginationInfo<
		TItem extends { id: TCursor },
		TCursor extends CursorType,
	>(params: { items: TItem[]; size: number }): CursorPaginationInfo<TCursor> {
		const { items, size } = params;
		const hasNext = items.length > size;

		// 다음 페이지 존재 확인을 위해 가져온 추가 아이템 제거 후 커서 계산
		const actualItems = hasNext ? items.slice(0, size) : items;
		const lastItem = actualItems[actualItems.length - 1];

		return {
			nextCursor: hasNext && lastItem ? lastItem.id : null,
			hasNext,
			size,
		};
	}

	/**
	 * 커서 기반 페이지네이션 응답 생성
	 * @template TItem - 아이템 타입 (id 필드 필수)
	 * @template TCursor - 커서 타입 (string | number)
	 */
	createCursorPaginatedResponse<
		TItem extends { id: TCursor },
		TCursor extends CursorType,
	>(params: {
		items: TItem[];
		size: number;
	}): CursorPaginatedResponse<TItem, TCursor> {
		const { items, size } = params;
		const hasNext = items.length > size;

		// 다음 페이지 확인용 추가 아이템 제거
		const actualItems = hasNext ? items.slice(0, size) : items;

		return {
			items: actualItems,
			pagination: this.createCursorPaginationInfo<TItem, TCursor>({
				items,
				size,
			}),
		};
	}
}

/**
 * 페이지네이션 유틸리티 (정적 메서드)
 * 서비스 주입이 불가능한 경우 사용
 */
export class PaginationUtil {
	// ============================================
	// 오프셋 기반 페이지네이션
	// ============================================

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
		const page = Math.max(1, params.page ?? PAGINATION_DEFAULT.PAGE);
		const size = Math.min(
			PAGINATION_DEFAULT.MAX_SIZE,
			Math.max(
				PAGINATION_DEFAULT.MIN_SIZE,
				params.size ?? PAGINATION_DEFAULT.SIZE,
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
				: (allowedFields[0] ?? SORT_DEFAULT.FIELD);

		const normalizedSortOrder: SortOrder = sortOrder === "ASC" ? "ASC" : "DESC";

		return {
			[normalizedSortBy]: normalizedSortOrder,
		};
	}

	// ============================================
	// 커서 기반 페이지네이션 (제네릭)
	// ============================================

	/**
	 * 커서 기반 페이지네이션 파라미터 정규화
	 */
	static normalizeCursorPagination<T extends CursorType>(
		params: CursorPaginationParams<T>,
	): NormalizedCursorPagination<T> {
		const size = Math.min(
			PAGINATION_DEFAULT.MAX_SIZE,
			Math.max(
				PAGINATION_DEFAULT.MIN_SIZE,
				params.size ?? PAGINATION_DEFAULT.SIZE,
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
	static createCursorPaginationInfo<
		TItem extends { id: TCursor },
		TCursor extends CursorType,
	>(params: { items: TItem[]; size: number }): CursorPaginationInfo<TCursor> {
		const { items, size } = params;
		const hasNext = items.length > size;

		const actualItems = hasNext ? items.slice(0, size) : items;
		const lastItem = actualItems[actualItems.length - 1];

		return {
			nextCursor: hasNext && lastItem ? lastItem.id : null,
			hasNext,
			size,
		};
	}

	/**
	 * 커서 기반 페이지네이션 응답 생성
	 */
	static createCursorPaginatedResponse<
		TItem extends { id: TCursor },
		TCursor extends CursorType,
	>(params: {
		items: TItem[];
		size: number;
	}): CursorPaginatedResponse<TItem, TCursor> {
		const { items, size } = params;
		const hasNext = items.length > size;

		const actualItems = hasNext ? items.slice(0, size) : items;

		return {
			items: actualItems,
			pagination: this.createCursorPaginationInfo<TItem, TCursor>({
				items,
				size,
			}),
		};
	}
}
