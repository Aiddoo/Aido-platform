import type { ErrorCodeType } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';
import { NetworkError, ParseError, ServerError, TimeoutError } from '@src/shared/errors';

import { canRetryPlanFailure, getVoicePlanFailureCause } from './voice.error';

describe('getVoicePlanFailureCause', () => {
  const serverError = (serverCode: ErrorCodeType | null) =>
    new ServerError(503, { serverCode, details: null, requestId: null, request: null });

  it.each([
    { name: '연결 끊김', error: new NetworkError(), cause: 'network' },
    { name: '응답 시간 초과', error: new TimeoutError(), cause: 'network' },
    { name: 'AI 업체 장애(503 AI_1301)', error: serverError('AI_1301'), cause: 'ai-unavailable' },
    { name: 'DB 과부하(503 SYS_0005)', error: serverError('SYS_0005'), cause: 'unknown' },
    { name: '코드 없는 5xx', error: serverError(null), cause: 'unknown' },
    { name: '계약과 다른 응답', error: new ParseError(), cause: 'unknown' },
    { name: 'AI 동의 필요', error: new ApiError('AI_1311', '', 403), cause: 'consent-required' },
    { name: '월 한도', error: new ApiError('AI_1303', '', 403), cause: 'limit' },
    { name: '일 한도', error: new ApiError('AI_1313', '', 429), cause: 'limit' },
    { name: '너무 긴 글', error: new ApiError('AI_1312', '', 413), cause: 'too-long' },
    { name: '처리 중', error: new ApiError('AI_1314', '', 409), cause: 'in-progress' },
    { name: '카테고리 거절', error: new ApiError('AI_1315', '', 422), cause: 'rejected' },
    { name: '같은 키 다른 내용', error: new ApiError('AI_1318', '', 409), cause: 'key-conflict' },
    {
      name: '원본 메모 없음',
      error: new ApiError('MEMO_2001', '', 404),
      cause: 'source-memo-missing',
    },
    { name: '메모 개수 한도', error: new ApiError('MEMO_2003', '', 403), cause: 'memo-limit' },
    { name: 'AI 결과 거절', error: new ApiError('AI_1302', '', 422), cause: 'ai-unavailable' },
    { name: 'AI 요청 한도', error: new ApiError('AI_1310', '', 429), cause: 'ai-unavailable' },
    { name: '모르는 4xx', error: new ApiError('SYS_0001', '', 400), cause: 'unknown' },
  ] as const)('$name은 $cause로 안내한다', ({ error, cause }) => {
    // When
    const result = getVoicePlanFailureCause(error);

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
