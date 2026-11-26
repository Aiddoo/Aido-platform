import type { RefreshTokensRequest } from '@src/core/ports/token-refresher';

import { mockMethod } from '../mock-method';

/** 토큰 갱신 요청. 응답은 값이 있어야 해 정하지 않고 부르면 이름을 대며 실패한다 */
export function createRefreshTokensRequestStub() {
  return mockMethod<RefreshTokensRequest>(async () => {
    throw new Error('createRefreshTokensRequestStub: 갱신 응답을 정하지 않았습니다');
  });
}
