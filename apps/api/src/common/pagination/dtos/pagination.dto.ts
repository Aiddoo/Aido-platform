import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { PAGINATION_DEFAULT } from "../constants/pagination.constant";

/**
 * 오프셋 기반 페이지네이션 DTO
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
 * String 커서 기반 페이지네이션 DTO
 * CUID, UUID 등 문자열 ID를 사용하는 엔티티용 (예: User)
 */
export class StringCursorPaginationDto {
	@IsOptional()
	@IsString()
	cursor?: string;

	@IsOptional()
	@IsInt()
	@Min(PAGINATION_DEFAULT.MIN_SIZE)
	@Max(PAGINATION_DEFAULT.MAX_SIZE)
	@Type(() => Number)
	size?: number = PAGINATION_DEFAULT.SIZE;
}

/**
 * Number 커서 기반 페이지네이션 DTO
 * auto-increment 등 숫자 ID를 사용하는 엔티티용 (예: Todo)
 */
export class NumberCursorPaginationDto {
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

/**
 * @deprecated CursorPaginationDto 대신 StringCursorPaginationDto 또는 NumberCursorPaginationDto 사용
 */
export class CursorPaginationDto extends StringCursorPaginationDto {}
