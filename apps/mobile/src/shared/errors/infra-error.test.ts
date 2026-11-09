import { isConnectivityError, NetworkError, ParseError, TimeoutError } from './infra-error';

describe('isConnectivityError', () => {
  it('네트워크 끊김과 시간 초과는 연결 오류로, 응답 파싱 실패는 일반 오류로 분류한다', () => {
    // Given
    const network = new NetworkError();
    const timeout = new TimeoutError();
    const parse = new ParseError('invalid');

    // When
    const isNetworkConnectivity = isConnectivityError(network);
    const isTimeoutConnectivity = isConnectivityError(timeout);
    const isParseConnectivity = isConnectivityError(parse);

    // Then
    expect(isNetworkConnectivity).toBe(true);
    expect(isTimeoutConnectivity).toBe(true);
    expect(isParseConnectivity).toBe(false);
  });
});
