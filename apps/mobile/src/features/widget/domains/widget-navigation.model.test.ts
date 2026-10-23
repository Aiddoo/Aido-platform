import {
  parseWidgetNavigationUri,
  WidgetNavigationPolicy,
  WIDGET_NAVIGATION_COMMAND_TTL_MS,
} from './widget-navigation.model';

describe('위젯 탐색 명령 정책', () => {
  it('만료 직전 명령만 허용하고 만료 시점과 미래 명령은 거절한다', () => {
    // Given
    const command = { createdAt: 1000 };

    // When / Then
    expect(WidgetNavigationPolicy.isFresh(command, 1000)).toBe(true);
    expect(
      WidgetNavigationPolicy.isFresh(command, 1000 + WIDGET_NAVIGATION_COMMAND_TTL_MS - 1),
    ).toBe(true);
    expect(WidgetNavigationPolicy.isFresh(command, 1000 + WIDGET_NAVIGATION_COMMAND_TTL_MS)).toBe(
      false,
    );
    expect(WidgetNavigationPolicy.isFresh(command, 999)).toBe(false);
  });

  it('계정을 바꾸면 이전 위젯의 명령을 실행하지 않는다', () => {
    // Given
    const command = { userId: 'original-account' };

    // When / Then
    expect(WidgetNavigationPolicy.isOwnedBy(command, 'original-account')).toBe(true);
    expect(WidgetNavigationPolicy.isOwnedBy(command, 'other-account')).toBe(false);
  });

  it('고정 날짜와 생성 동작을 원시값으로 보존한다', () => {
    // Given
    const uri = 'aido://feed?date=2026-10-05&action=add-todo';

    // When
    const destination = parseWidgetNavigationUri(uri);

    // Then
    expect(destination).toEqual({ kind: 'feed', date: '2026-10-05', action: 'add-todo' });
  });

  it.each([
    'aido://feed:8080?date=today',
    'aido://todo/1?extra=true',
    'aido://feed?date=2026-02-30',
    'aido://feed?date=today&date=2026-10-05',
    'aido://feed?date=today&action=add-todo&action=add-todo',
  ])('외부 포트나 지원하지 않는 URI %s를 거절한다', (uri) => {
    // Given / When / Then
    expect(parseWidgetNavigationUri(uri)).toBeNull();
  });
});
