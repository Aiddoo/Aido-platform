import type { ErrorCodeType } from '@aido/api/errors';
import { NetworkError, ParseError, ServerError, TimeoutError } from '@src/shared/errors';
import { createApiError } from '@src/testing/core';

import { canRetryPlanFailure, getVoicePlanFailure } from './voice.error';

describe('getVoicePlanFailure', () => {
  const serverError = (serverCode: ErrorCodeType | null) =>
    new ServerError(503, { serverCode, details: null, requestId: null, request: null });

  it.each([
    { name: '연결 끊김', error: new NetworkError(), cause: 'network' },
    { name: '응답 시간 초과', error: new TimeoutError(), cause: 'network' },
    { name: 'AI 업체 장애(503 AI_1301)', error: serverError('AI_1301'), cause: 'ai-unavailable' },
    { name: 'DB 과부하(503 SYS_0005)', error: serverError('SYS_0005'), cause: 'unknown' },
    { name: '코드 없는 5xx', error: serverError(null), cause: 'unknown' },
    { name: '계약과 다른 응답', error: new ParseError(), cause: 'unknown' },
    {
      name: 'AI 동의 필요',
      error: createApiError('AI_1311', { message: '' }),
      cause: 'consent-required',
    },
    {
      name: '월 한도',
      error: createApiError('AI_1303', { message: '', status: 403 }),
      cause: 'limit',
    },
    { name: '일 한도', error: createApiError('AI_1313', { message: '' }), cause: 'limit' },
    {
      name: '너무 긴 글',
      error: createApiError('AI_1312', { message: '', status: 413 }),
      cause: 'too-long',
    },
    { name: '처리 중', error: createApiError('AI_1314', { message: '' }), cause: 'in-progress' },
    { name: '카테고리 거절', error: createApiError('AI_1315', { message: '' }), cause: 'rejected' },
    {
      name: '같은 키 다른 내용',
      error: createApiError('AI_1318', { message: '', status: 409 }),
      cause: 'key-conflict',
    },
    {
      name: '원본 메모 없음',
      error: createApiError('MEMO_2001', { message: '' }),
      cause: 'source-memo-missing',
    },
    {
      name: '메모 개수 한도',
      error: createApiError('MEMO_2003', { message: '' }),
      cause: 'memo-limit',
    },
    {
      name: 'AI 결과 거절',
      error: createApiError('AI_1302', { message: '' }),
      cause: 'ai-unavailable',
    },
    {
      name: 'AI 요청 한도',
      error: createApiError('AI_1310', { message: '' }),
      cause: 'ai-unavailable',
    },
    {
      name: '모르는 4xx',
      error: createApiError('SYS_0001', { message: '', status: 400 }),
      cause: 'unknown',
    },
  ] as const)('$name은 $cause로 안내한다', ({ error, cause }) => {
    // When
    const result = getVoicePlanFailure(error);

    // Then
    expect(result).toBe(cause);
  });
});

describe('canRetryPlanFailure', () => {
  it('너무 긴 글은 다시 보내도 소용없다', () => {
    // When
    const result = canRetryPlanFailure('too-long');

    // Then
    expect(result).toBe(false);
  });

  it('네트워크 실패는 다시 보낼 수 있다', () => {
    // When
    const result = canRetryPlanFailure('network');

    // Then
    expect(result).toBe(true);
  });
});
