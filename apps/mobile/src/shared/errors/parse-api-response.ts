import type { ApiError } from '@src/core/errors/api-error';
import { ok, type Result } from '@src/core/errors/result';
import type { z } from 'zod';

import { ParseError } from './infra-error';

/**
 * 4xx는 그대로 돌려주고, 응답이 계약과 다르면 던지고, 맞으면 앱 모델로 바꾼다.
 * 던지기 전에 남길 로그가 있으면 `logInvalid`가 검증 메시지를 받는다.
 */
export function parseApiResponse<TSchema extends z.ZodType, TModel>(
  result: Result<unknown, ApiError>,
  schema: TSchema,
  toModel: (dto: z.output<TSchema>) => TModel,
  errorPrefix: string,
  logInvalid?: (zodMessage: string) => void,
): Result<TModel, ApiError> {
  if (!result.ok) {
    return result;
  }

  const parsed = schema.safeParse(result.value);
  if (!parsed.success) {
    logInvalid?.(parsed.error.message);
    throw new ParseError(`${errorPrefix}: ${parsed.error.message}`);
  }

  return ok(toModel(parsed.data));
}
