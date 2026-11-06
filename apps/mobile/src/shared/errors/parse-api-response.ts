import type { z } from 'zod';

import type { ApiError } from './api-error';
import { ParseError } from './infra-error';
import { ok, type Result } from './result';

/** 4xx는 그대로 돌려주고, 응답이 계약과 다르면 던지고, 맞으면 앱 모델로 바꾼다 */
export function parseApiResponse<TSchema extends z.ZodType, TModel>(
  result: Result<unknown, ApiError>,
  schema: TSchema,
  toModel: (dto: z.output<TSchema>) => TModel,
  errorPrefix: string,
): Result<TModel, ApiError> {
  if (!result.ok) {
    return result;
  }

  const parsed = schema.safeParse(result.value);
  if (!parsed.success) {
    throw new ParseError(`${errorPrefix}: ${parsed.error.message}`);
  }

  return ok(toModel(parsed.data));
}
