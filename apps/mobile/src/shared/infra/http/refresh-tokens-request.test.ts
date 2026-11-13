import type * as NodeCrypto from 'node:crypto';

import { ENV } from '@src/shared/config/env';

import { createRefreshTokensRequest } from './refresh-tokens-request';
import { REQUEST_ID_HEADER } from './request-headers';

// 네이티브 expo-crypto는 Jest에 없으므로 같은 계약(UUID v4)의 Node 구현으로 바꾼다.
jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<typeof NodeCrypto>('node:crypto').randomUUID(),
}));

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('토큰 갱신 요청', () => {
  let sent: Request[];

  beforeEach(() => {
    sent = [];
    global.fetch = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(async (input) => {
      if (!(input instanceof Request)) {
        throw new Error('ky가 Request가 아닌 fetch 입력을 넘겼다');
      }
      sent.push(input);
      return new Response('{}', { status: 401 });
    });
  });

  it('일반 요청과 같은 앱·기기·시간대·요청 ID 헤더와 리프레시 토큰을 보낸다', async () => {
    // Given
    const requestRefresh = createRefreshTokensRequest({ appVersion: '1.14.2', appBuild: '512' });

    // When
    const response = await requestRefresh('refresh-1');

    // Then
    const [request] = sent;
    expect(response.status).toBe(401);
    expect(request?.url).toBe(`${ENV.API_URL}/v1/auth/refresh`);
    expect(request?.method).toBe('POST');
    expect(request?.headers.get('Authorization')).toBe('Bearer refresh-1');
    expect(request?.headers.get('X-App-Version')).toBe('1.14.2');
    expect(request?.headers.get('X-App-Build')).toBe('512');
    expect(request?.headers.get('X-Device-Type')).toEqual(expect.any(String));
    expect(request?.headers.get('X-Timezone')).toEqual(expect.any(String));
    expect(request?.headers.get(REQUEST_ID_HEADER)).toMatch(UUID_PATTERN);
  });

  it('갱신 실패 응답을 throw하지 않고 갱신기에 그대로 넘긴다', async () => {
    // Given
    const requestRefresh = createRefreshTokensRequest({ appVersion: null, appBuild: null });

    // When
    const response = await requestRefresh('refresh-1');

    // Then
    expect(response.ok).toBe(false);
    expect(sent).toHaveLength(1);
  });
});
