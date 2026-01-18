// Constants
export {
	PAGINATION_DEFAULT,
	SORT_DEFAULT,
	type SortOrder,
} from "./constants/pagination.constant";

// DTOs
export {
	CursorPaginationDto,
	NumberCursorPaginationDto,
	PaginationDto,
	StringCursorPaginationDto,
} from "./dtos/pagination.dto";

// Interfaces
export type {
	// 커서 기반 (제네릭)
	CursorPaginatedResponse,
	CursorPaginationInfo,
	CursorPaginationParams,
	// 커서 타입
	CursorType,
	NormalizedCursorPagination,
	// 오프셋 기반
	NormalizedPagination,
	// 타입 별칭 (편의성)
	NumberCursorPaginatedResponse,
	NumberCursorPaginationInfo,
	NumberCursorPaginationParams,
	PaginatedResponse,
	PaginationInfo,
	PaginationParams,
	SortParams,
	StringCursorPaginatedResponse,
	StringCursorPaginationInfo,
	StringCursorPaginationParams,
} from "./interfaces/pagination.interface";

// Module
export { PaginationModule } from "./pagination.module";

// Services
export {
	PaginationService,
	PaginationUtil,
} from "./services/pagination.service";
