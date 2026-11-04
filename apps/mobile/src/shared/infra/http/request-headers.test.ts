import type * as NodeCrypto from 'node:crypto';

import ky from 'ky';

import { applyPerRequestHeaders, REQUEST_ID_HEADER } from './request-headers';

// 네이티브 expo-crypto는 Jest에 없으므로 같은 계약(UUID v4)의 Node 구현으로 바꾼다.
jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<typeof NodeCrypto>('node:crypto').randomUUID(),
}));

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** ky는 fetch에 항상 Request를 넘긴다. 다른 입력이면 테스트 전제가 깨진 것이다. */
const requestOf = (input: Parameters<typeof fetch>[0]): Request => {
  if (!(input instanceof Request)) {
    throw new Error('ky가 Request가 아닌 fetch 입력을 넘겼다');
  }
  return input;
};

describe('요청마다 정하는 헤더 (beforeRequest)', () => {
  let sent: Request[];

  beforeEach(() => {
    sent = [];
    global.fetch = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(async (input) => {
      sent.push(requestOf(input));
      return new Response('{}', { status: 200 });
    });
  });

  it('요청마다 새 X-Request-Id(UUID)와 X-Timezone을 붙인다', async () => {
    // Given
    const client = ky.create({
      prefix: 'https://api.test',
      hooks: { beforeRequest: [applyPerRequestHeaders] },
    });

    // When
    await client.get('v1/todos');
    await client.get('v1/todos');

    // Then
    const [first, second] = sent.map((request) => request.headers.get(REQUEST_ID_HEADER));
    expect(first).toMatch(UUID_PATTERN);
    expect(second).toMatch(UUID_PATTERN);
    expect(second).not.toBe(first);
    expect(sent[0]?.headers.get('X-Timezone')).toEqual(expect.any(String));
  });
});
