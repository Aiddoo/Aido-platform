import type { ApiError } from '@src/core/errors/api-error';
import { ok, type Result } from '@src/core/errors/result';
import { type z, ZodError } from 'zod';

import { ParseError } from './infra-error';

/**
 * 4xx는 그대로 돌려주고, 응답이 계약과 다르면 던지고, 맞으면 앱 모델로 바꾼다.
 * 응답 스키마와 mapper(`toModel`)의 검증 실패는 모두 `ParseError`다. 던지기 전에 남길 로그가 있으면 `logInvalid`가 검증 메시지를 받는다.
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
    throw toParseError(parsed.error, errorPrefix, logInvalid);
  }

  try {
    return ok(toModel(parsed.data));
  } catch (error) {
    // mapper의 모델 스키마 parse 실패도 응답 계약 위반이다. ZodError로 두면 보고·재시도·문구가 따로 논다
    if (error instanceof ZodError) {
      throw toParseError(error, errorPrefix, logInvalid);
    }
    throw error;
  }
}

function toParseError(
  error: ZodError,
  errorPrefix: string,
  logInvalid: ((zodMessage: string) => void) | undefined,
): ParseError {
  logInvalid?.(error.message);
  return new ParseError(`${errorPrefix}: ${error.message}`);
}
