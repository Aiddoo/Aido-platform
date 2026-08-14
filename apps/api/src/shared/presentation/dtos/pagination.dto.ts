import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { PAGINATION_DEFAULT } from "@/shared/application/pagination/constants/pagination.constant";

const paginationSchema = z.object({
	page: z.coerce.number().int().min(1).default(PAGINATION_DEFAULT.PAGE),
	size: z.coerce
		.number()
		.int()
		.min(PAGINATION_DEFAULT.MIN_SIZE)
		.max(PAGINATION_DEFAULT.MAX_SIZE)
		.default(PAGINATION_DEFAULT.SIZE),
});

export class PaginationDto extends createZodDto(paginationSchema) {}

const stringCursorPaginationSchema = z.object({
	cursor: z.string().optional(),
	size: z.coerce
		.number()
		.int()
		.min(PAGINATION_DEFAULT.MIN_SIZE)
		.max(PAGINATION_DEFAULT.MAX_SIZE)
		.default(PAGINATION_DEFAULT.SIZE),
});

export class StringCursorPaginationDto extends createZodDto(stringCursorPaginationSchema) {}

const numberCursorPaginationSchema = z.object({
	cursor: z.coerce.number().int().min(1).optional(),
	size: z.coerce
		.number()
		.int()
		.min(PAGINATION_DEFAULT.MIN_SIZE)
		.max(PAGINATION_DEFAULT.MAX_SIZE)
		.default(PAGINATION_DEFAULT.SIZE),
});

export class NumberCursorPaginationDto extends createZodDto(numberCursorPaginationSchema) {}
