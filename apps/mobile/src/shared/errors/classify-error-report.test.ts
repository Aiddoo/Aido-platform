import { ApiError } from '@src/core/errors/api-error';
import { ZodError } from 'zod';

import {
  classifyErrorReport,
  type ErrorReportKind,
  getErrorReportTags,
} from './classify-error-report';
import { NetworkError, ParseError, ServerError, TimeoutError } from './infra-error';
import { KeychainLockedError } from './storage-error';

describe('classifyErrorReport', () => {
  it.each<[string, unknown, ErrorReportKind]>([
    ['400 ApiError', new ApiError('X', 'x', 400), 'breadcrumb'],
    ['404 ApiError', new ApiError('X', 'x', 404), 'breadcrumb'],
    ['409 ApiError', new ApiError('X', 'x', 409), 'breadcrumb'],
    ['코드를 가진 BusinessError', Object.assign(new Error('x'), { code: 'X' }), 'breadcrumb'],
    ['검증 실패 ZodError', new ZodError([]), 'breadcrumb'],
    ['네트워크 오류', new NetworkError(), 'breadcrumb'],
    ['타임아웃', new TimeoutError(), 'breadcrumb'],
    ['키체인 잠금', new KeychainLockedError(new Error('locked')), 'breadcrumb'],
    ['5xx ServerError', new ServerError(500), 'event'],
    ['503 ServerError', new ServerError(503, 'req-1'), 'event'],
    ['응답 파싱 실패', new ParseError('invalid'), 'event'],
    ['5xx ApiError', new ApiError('X', 'x', 502), 'event'],
    ['잡지 못한 일반 오류', new Error('boom'), 'event'],
    ['TypeError', new TypeError('undefined is not a function'), 'event'],
  ])('%s는 %s로 보낸다', (_name, error, expected) => {
    // When
    const kind = classifyErrorReport(error);

    // Then
    expect(kind).toBe(expected);
  });
});

describe('getErrorReportTags', () => {
  it('서버 장애는 상태와 실패한 요청을 태그로 남겨 어느 API인지 찾게 한다', () => {
    // Given
    const error = new ServerError(503, 'req-1', {
      method: 'POST',
      endpoint: '/v1/todos/1/comments',
    });

    // When
    const tags = getErrorReportTags(error);

    // Then
    expect(tags).toEqual({ statusCode: 503, method: 'POST', endpoint: '/v1/todos/1/comments' });
  });

  it('요청 정보가 없는 오류는 태그를 더하지 않는다', () => {
    // When
    const tags = [new ParseError('invalid'), new Error('boom')].map(getErrorReportTags);

    // Then
    expect(tags).toEqual([{}, {}]);
  });
});
