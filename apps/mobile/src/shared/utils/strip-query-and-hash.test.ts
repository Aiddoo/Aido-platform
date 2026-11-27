import { stripQueryAndHash } from './strip-query-and-hash';

describe('stripQueryAndHash', () => {
  it.each([
    [
      '절대 URL의 쿼리를 지운다',
      'https://api.aido.kr/v1/todos?date=2026-11-26',
      'https://api.aido.kr/v1/todos',
    ],
    ['앱 경로의 쿼리를 지운다', '/friends/invite?source=push', '/friends/invite'],
    ['해시가 쿼리보다 앞이면 해시부터 지운다', 'ABC123#x?y', 'ABC123'],
    ['쿼리·해시가 없으면 그대로다', '/todo/12', '/todo/12'],
    ['쿼리 뒤 줄바꿈도 함께 지운다', '/a?token=1\nmore', '/a'],
    ['?로 시작하면 빈 문자열이다', '?a=1', ''],
  ])('%s', (_case, url, expected) => {
    // When
    const stripped = stripQueryAndHash(url);

    // Then
    expect(stripped).toBe(expected);
  });
});
