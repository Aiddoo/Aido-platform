import { ErrorCode } from '@aido/api/errors';
import {
  ApiError,
  BusinessError,
  KeychainLockedError,
  NetworkError,
  ParseError,
  ServerError,
  TimeoutError,
} from '@src/shared/errors';

import { shouldRetryQuery } from './query-retry';

describe('shouldRetryQuery', () => {
  it.each<[string, unknown, number]>([
    // 콜드 스타트·서버 재시작 구간을 기다린다(재시도 창 ≈ 22초). 토큰 갱신의 일시 실패도 이 세 타입이다
    ['네트워크 끊김', new NetworkError(), 6],
    ['시간 초과', new TimeoutError(), 6],
    ['500', new ServerError(500), 6],
    ['503', new ServerError(503), 6],
    ['응답 계약 위반', new ParseError('invalid'), 0],
    ['401', new ApiError(ErrorCode.AUTH_0101, '다시 로그인', 401), 0],
    ['403', new ApiError(ErrorCode.AUTH_0108, '권한 없음', 403), 0],
    ['409', new ApiError(ErrorCode.MEMO_2001, '한도 초과', 409), 0],
    ['앱 BusinessError', new BusinessError('FRIEND_EMPTY_TAG'), 0],
    ['키체인 잠금', new KeychainLockedError(new Error('locked')), 3],
    ['코드 버그', new TypeError('x is not a function'), 3],
  ])('%s는 %i번까지 다시 받는다', (_case, error, maxRetries) => {
    // When
    const retries = [0, 1, 2, 3, 4, 5, 6].filter((failureCount) =>
      shouldRetryQuery(failureCount, error),
    );

    // Then
    expect(retries).toHaveLength(maxRetries);
  });
});
