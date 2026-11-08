import { z } from 'zod';

const ROUTE_INTEGER_PATTERN = /^[1-9]\d*$/;

/** 읽기만 하는 값이라 `z.encode`는 지나가지 못한다 */
export const routeIntegerStringSchema = z
  .string()
  .regex(ROUTE_INTEGER_PATTERN)
  .transform((value): unknown => value);

export const routeIdSchema = z.codec(z.string().regex(ROUTE_INTEGER_PATTERN), z.int().positive(), {
  decode: Number,
  encode: String,
});
