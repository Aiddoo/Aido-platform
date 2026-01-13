import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { PAGINATION_DEFAULT } from "../constants/pagination.constant";

/**
 * 페이지네이션 DTO
 */
export class PaginationDto {
	@IsOptional()
	@IsInt()
	@Min(1)
	@Type(() => Number)
	page?: number = PAGINATION_DEFAULT.PAGE;

	@IsOptional()
	@IsInt()
	@Min(PAGINATION_DEFAULT.MIN_SIZE)
	@Max(PAGINATION_DEFAULT.MAX_SIZE)
	@Type(() => Number)
	size?: number = PAGINATION_DEFAULT.SIZE;
}

/**
 * 커서 기반 페이지네이션 DTO
 */
export class CursorPaginationDto {
	@IsOptional()
	@IsInt()
	@Min(1)
	@Type(() => Number)
	cursor?: number;

	@IsOptional()
	@IsInt()
	@Min(PAGINATION_DEFAULT.MIN_SIZE)
	@Max(PAGINATION_DEFAULT.MAX_SIZE)
	@Type(() => Number)
	size?: number = PAGINATION_DEFAULT.SIZE;
}
