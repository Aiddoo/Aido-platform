import { resolveWidgetAppRoute } from './resolve-widget-app-route';

describe('위젯 앱 진입 경로 검증', () => {
  it.each(['aido', 'aido-dev', 'aido-preview'])('%s 위젯의 오늘 생성 요청을 유지한다', (scheme) => {
    // Given
    const url = `${scheme}://feed?date=today&action=add-todo`;

    // When
    const route = resolveWidgetAppRoute(url);

    // Then
    expect(route).toEqual({ pathname: '/feed', params: { date: 'today', action: 'add-todo' } });
  });

  it('주간 달력에서 선택한 고정 날짜를 유지한다', () => {
    // Given
    const url = 'aido://feed?date=2026-10-05';

    // When
    const route = resolveWidgetAppRoute(url);

    // Then
    expect(route).toEqual({ pathname: '/feed', params: { date: '2026-10-05' } });
  });

  it('할 일 식별자를 실제 Expo Router 파일명에 맞게 전달한다', () => {
    // Given
    const url = 'aido://todo/123';

    // When
    const route = resolveWidgetAppRoute(url);

    // Then
    expect(route).toEqual({ pathname: '/todo/[todoId]', params: { todoId: '123' } });
  });

  it.each([
    null,
    'invalid',
    'https://aido.kr/feed?date=today',
    'aido://settings',
    'aido://feed?date=2026-02-30',
    'aido://feed?date=today&action=delete',
    'aido://feed?date=today&friendId=other',
    'aido://todo/0',
    'aido://todo/-1',
    'aido://todo/9007199254740992',
    'aido://todo/1?extra=true',
    'aido://user:password@todo/1',
    'aido://todo/1#fragment',
  ])('허용되지 않거나 손상된 초기 URL %s는 다시 이동하지 않는다', (url) => {
    // Given
    const initialUrl = url;

    // When
    const route = resolveWidgetAppRoute(initialUrl);

    // Then
    expect(route).toBeNull();
  });
});
