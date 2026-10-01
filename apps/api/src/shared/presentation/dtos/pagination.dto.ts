import { z } from "zod";

import { PAGINATION_DEFAULT } from "#api/shared/application/pagination/constants/pagination.constant";

const paginationSchema = z.object({
	page: z.coerce.number().int().min(1).default(PAGINATION_DEFAULT.PAGE),
	size: z.coerce
		.number()
		.int()
		.min(PAGINATION_DEFAULT.MIN_SIZE)
		.max(PAGINATION_DEFAULT.MAX_SIZE)
		.default(PAGINATION_DEFAULT.SIZE),
});

export const PaginationDto = paginationSchema.meta({ id: "PaginationDto" });
export type PaginationDto = z.infer<typeof PaginationDto>;

const stringCursorPaginationSchema = z.object({
	cursor: z.string().optional(),
	size: z.coerce
		.number()
		.int()
		.min(PAGINATION_DEFAULT.MIN_SIZE)
		.max(PAGINATION_DEFAULT.MAX_SIZE)
		.default(PAGINATION_DEFAULT.SIZE),
});

export const StringCursorPaginationDto = stringCursorPaginationSchema.meta({
	id: "StringCursorPaginationDto",
});
export type StringCursorPaginationDto = z.infer<typeof StringCursorPaginationDto>;

const numberCursorPaginationSchema = z.object({
	cursor: z.coerce.number().int().min(1).optional(),
	size: z.coerce
		.number()
		.int()
		.min(PAGINATION_DEFAULT.MIN_SIZE)
		.max(PAGINATION_DEFAULT.MAX_SIZE)
		.default(PAGINATION_DEFAULT.SIZE),
});

export const NumberCursorPaginationDto = numberCursorPaginationSchema.meta({
	id: "NumberCursorPaginationDto",
});
export type NumberCursorPaginationDto = z.infer<typeof NumberCursorPaginationDto>;
