import { ApiError } from '@src/core/errors/api-error';
import { err, ok } from '@src/core/errors/result';
import { z } from 'zod';

import { ParseError } from './infra-error';
import { parseApiResponse } from './parse-api-response';

const schema = z.object({ count: z.number() });

function toCount(dto: z.output<typeof schema>) {
  return dto.count + 1;
}

describe('parseApiResponse', () => {
  it('응답이 계약과 맞으면 앱 모델로 바꾼다', () => {
    // Given
    const response = ok({ count: 1 });

    // When
    const result = parseApiResponse(response, schema, toCount, '[Test] Invalid response');

    // Then
    expect(result).toEqual({ ok: true, value: 2 });
  });

  it('4xx 결과는 파싱하지 않고 그대로 돌려준다', () => {
    // Given
    const response = err(new ApiError('SYS_0001', '실패', 400));

    // When
    const result = parseApiResponse(response, schema, toCount, '[Test] Invalid response');

    // Then
    expect(result).toBe(response);
  });

  it('응답이 계약과 다르면 접두어가 붙은 ParseError를 던진다', () => {
    // Given
    const response = ok({ count: 'one' });

    // When
    const parse = () => parseApiResponse(response, schema, toCount, '[Test] Invalid response');

    // Then
    expect(parse).toThrow(ParseError);
    expect(parse).toThrow(/^\[Test\] Invalid response: /);
  });

  it('mapper의 모델 스키마 검증 실패도 ZodError가 아니라 같은 ParseError로 던진다', () => {
    // Given
    const response = ok({ count: -1 });
    const toPositiveCount = (dto: z.output<typeof schema>) =>
      z.number().positive().parse(dto.count);

    // When
    const parse = () =>
      parseApiResponse(response, schema, toPositiveCount, '[Test] Invalid response');

    // Then
    expect(parse).toThrow(ParseError);
    expect(parse).toThrow(/^\[Test\] Invalid response: /);
  });
});
