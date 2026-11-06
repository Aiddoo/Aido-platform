import { parseWidgetNavigationUri } from '../schemas/widget-navigation.schema';
import {
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

describe('위젯 앱 진입 경로 검증', () => {
  it.each(['aido', 'aido-dev', 'aido-preview'])('%s 위젯의 오늘 생성 요청을 유지한다', (scheme) => {
    // Given
    const url = `${scheme}://feed?date=today&action=add-todo`;

    // When
    const route = WidgetNavigationPolicy.getRoute(url);

    // Then
    expect(route).toEqual({ pathname: '/feed', params: { date: 'today', action: 'add-todo' } });
  });

  it('주간 달력에서 선택한 고정 날짜를 유지한다', () => {
    // Given
    const url = 'aido://feed?date=2026-10-05';

    // When
    const route = WidgetNavigationPolicy.getRoute(url);

    // Then
    expect(route).toEqual({ pathname: '/feed', params: { date: '2026-10-05' } });
  });

  it('할 일 식별자를 실제 Expo Router 파일명에 맞게 전달한다', () => {
    // Given
    const url = 'aido://todo/123';

    // When
    const route = WidgetNavigationPolicy.getRoute(url);

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
    const route = WidgetNavigationPolicy.getRoute(initialUrl);

    // Then
    expect(route).toBeNull();
  });
});

describe('위젯 목적지가 이미 보이는지 판단', () => {
  it('같은 날짜의 내 피드가 보이면 다시 이동하지 않는다', () => {
    expect(WidgetNavigationPolicy.isCurrentRoute('aido://feed?date=today', '/feed', {})).toBe(true);
  });

  it('같은 피드 화면이라도 친구 피드가 보이면 내 피드로 이동한다', () => {
    expect(
      WidgetNavigationPolicy.isCurrentRoute('aido://feed?date=today', '/feed', {
        friendId: 'friend-1',
      }),
    ).toBe(false);
  });

  it('할 일 상세는 pathname으로 판단한다', () => {
    expect(WidgetNavigationPolicy.isCurrentRoute('aido://todo/123', '/todo/123', {})).toBe(true);
  });
});
