import {
  clearColdStartPath,
  getColdStartPath,
  rememberColdStartLink,
  toColdStartAppPath,
} from './cold-start-link';

describe('toColdStartAppPath', () => {
  it.each([
    ['aido://weather/reschedule?reason=rain', '/weather/reschedule?reason=rain'],
    ['aido:///settings/theme', '/settings/theme'],
    ['/whats-new', '/whats-new'],
  ])('%s를 앱 경로로 바꾼다', (url, expected) => {
    // When
    const result = toColdStartAppPath(url, 'aido');

    // Then
    expect(result).toBe(expected);
  });

  it.each([
    'aido://auth/callback?code=1',
    'aido://invite/ABC',
    '/i/ABC',
    'aido://feed?action=add-todo',
    'aido://',
    '/',
    'https://aido.kr/settings',
    'kakao123://kakaolink',
  ])('%s는 다른 곳이 처리하므로 맡지 않는다', (url) => {
    // When
    const result = toColdStartAppPath(url, 'aido');

    // Then
    expect(result).toBeNull();
  });
});

describe('콜드 스타트 링크 보관', () => {
  afterEach(clearColdStartPath);

  it('첫 화면이 지울 때까지 경로를 남긴다', () => {
    // Given
    rememberColdStartLink('aido://settings/theme', 'aido');

    // When
    const beforeClear = getColdStartPath();
    clearColdStartPath();

    // Then
    expect(beforeClear).toBe('/settings/theme');
    expect(getColdStartPath()).toBeNull();
  });
});
