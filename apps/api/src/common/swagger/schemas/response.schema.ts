import { ApiProperty } from "@nestjs/swagger";

/**
 * Swagger 문서용 에러 상세 스키마
 */
export class ErrorDetailSchema {
	@ApiProperty({
		description: "에러 코드",
		example: "USER_NOT_FOUND",
	})
	code!: string;

	@ApiProperty({
		description: "에러 메시지",
		example: "사용자를 찾을 수 없습니다.",
	})
	message!: string;

	@ApiProperty({
		description: "추가 에러 상세 정보",
		example: { field: "email", reason: "invalid format" },
		required: false,
		nullable: true,
	})
	details?: Record<string, unknown> | null;
}

/**
 * Swagger 문서용 에러 응답 스키마
 */
export class ErrorResponseSchema {
	@ApiProperty({
		description: "요청 성공 여부",
		example: false,
	})
	success!: false;

	@ApiProperty({
		description: "에러 정보",
		type: ErrorDetailSchema,
	})
	error!: ErrorDetailSchema;

	@ApiProperty({
		description: "응답 타임스탬프 (Unix timestamp)",
		example: 1704067200000,
	})
	timestamp!: number;
}

/**
 * Swagger 문서용 페이지네이션 정보 스키마
 * @see PaginationInfo in common/pagination/interfaces/pagination.interface.ts
 */
export class PaginationInfoSchema {
	@ApiProperty({
		description: "현재 페이지 번호",
		example: 1,
	})
	page!: number;

	@ApiProperty({
		description: "페이지당 아이템 수",
		example: 10,
	})
	size!: number;

	@ApiProperty({
		description: "전체 아이템 수",
		example: 100,
	})
	total!: number;

	@ApiProperty({
		description: "전체 페이지 수",
		example: 10,
	})
	totalPages!: number;

	@ApiProperty({
		description: "다음 페이지 존재 여부",
		example: true,
	})
	hasNext!: boolean;

	@ApiProperty({
		description: "이전 페이지 존재 여부",
		example: false,
	})
	hasPrevious!: boolean;
}

/**
 * Swagger 문서용 커서 기반 페이지네이션 정보 스키마
 * @see CursorPaginationInfo in common/pagination/interfaces/pagination.interface.ts
 */
export class CursorPaginationInfoSchema {
	@ApiProperty({
		description: "다음 페이지 커서 (마지막 아이템 ID)",
		example: 25,
		nullable: true,
	})
	nextCursor!: number | null;

	@ApiProperty({
		description: "이전 페이지 커서 (첫 번째 아이템 ID)",
		example: 5,
		nullable: true,
	})
	prevCursor!: number | null;

	@ApiProperty({
		description: "다음 페이지 존재 여부",
		example: true,
	})
	hasNext!: boolean;

	@ApiProperty({
		description: "이전 페이지 존재 여부",
		example: true,
	})
	hasPrevious!: boolean;

	@ApiProperty({
		description: "페이지당 아이템 수",
		example: 20,
	})
	size!: number;
}
