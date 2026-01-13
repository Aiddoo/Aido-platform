/**
 * 페이지네이션 기본값
 */
export const PAGINATION_DEFAULT = {
	PAGE: 1,
	SIZE: 20,
	MAX_SIZE: 100,
	MIN_SIZE: 1,
} as const;

/**
 * 정렬 기본값
 */
export const SORT_DEFAULT = {
	ORDER: "DESC",
	FIELD: "id",
} as const;

export type SortOrder = "ASC" | "DESC";
