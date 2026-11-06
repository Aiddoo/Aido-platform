import { z } from 'zod';

export const ROUTE_INTEGER_PATTERN = /^[1-9]\d*$/;

export const routeIntegerStringSchema = z
  .string()
  .regex(ROUTE_INTEGER_PATTERN)
  .transform((value): unknown => value);

export const routeIdSchema = z
  .string()
  .regex(ROUTE_INTEGER_PATTERN)
  .transform(Number)
  .pipe(z.int().positive());
