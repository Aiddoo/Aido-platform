import { z } from 'zod';

import { ApiError } from './api-error';
import { ParseError } from './infra-error';
import { parseApiResponse } from './parse-api-response';
import { err, ok } from './result';

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

  it('응답이 계약과 다르면 던지기 전에 검증 메시지를 로그 함수로 넘긴다', () => {
    // Given
    const response = ok({ count: 'one' });
    const logInvalid = jest.fn();

    // When
    expect(() =>
      parseApiResponse(response, schema, toCount, '[Test] Invalid response', logInvalid),
    ).toThrow(ParseError);

    // Then
    expect(logInvalid).toHaveBeenCalledTimes(1);
  });
});
