import { z } from 'zod';

export const routeIntegerStringSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform((value): unknown => value);
