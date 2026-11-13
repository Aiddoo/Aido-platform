import { fromEpochMs, toEpochMs, toInstant } from '@src/shared/date/instant';

import { createWidgetNavigationCommand } from '../__tests__/widget-navigation.fixtures';
import { parseWidgetNavigationUri, WidgetNavigationPolicy } from './widget-navigation.model';

/** 위젯을 누른 뒤 5분 안에 앱이 열려야 저장된 목적지로 옮긴다 */
const WIDGET_NAVIGATION_COMMAND_TTL_MS = 5 * 60_000;
const CREATED_AT = toInstant('2026-11-05T00:00:00.000Z');
const afterCreation = (elapsedMs: number) => fromEpochMs(toEpochMs(CREATED_AT) + elapsedMs);

describe('isFresh', () => {
  it('만료 직전 명령만 허용하고 만료 시점과 미래 명령은 거절한다', () => {
    // Given
    const command = createWidgetNavigationCommand({ createdAt: CREATED_AT });

    // When
    const atCreation = WidgetNavigationPolicy.isFresh(command, CREATED_AT);
    const justBeforeExpiry = WidgetNavigationPolicy.isFresh(
      command,
      afterCreation(WIDGET_NAVIGATION_COMMAND_TTL_MS - 1),
    );
    const atExpiry = WidgetNavigationPolicy.isFresh(
      command,
      afterCreation(WIDGET_NAVIGATION_COMMAND_TTL_MS),
    );
    const beforeCreation = WidgetNavigationPolicy.isFresh(command, afterCreation(-1));

    // Then
    expect(atCreation).toBe(true);
    expect(justBeforeExpiry).toBe(true);
    expect(atExpiry).toBe(false);
    expect(beforeCreation).toBe(false);
  });
});

describe('isOwnedBy', () => {
  it('계정을 바꾸면 이전 위젯의 명령을 실행하지 않는다', () => {
    // Given
    const command = createWidgetNavigationCommand({ userId: 'original-account' });

    // When
    const sameAccount = WidgetNavigationPolicy.isOwnedBy(command, 'original-account');
    const otherAccount = WidgetNavigationPolicy.isOwnedBy(command, 'other-account');

    // Then
    expect(sameAccount).toBe(true);
    expect(otherAccount).toBe(false);
  });
});

describe('parseWidgetNavigationUri', () => {
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
    // When
    const destination = parseWidgetNavigationUri(uri);

    // Then
    expect(destination).toBeNull();
  });
});

describe('getCommandState', () => {
  const command = createWidgetNavigationCommand({
    createdAt: CREATED_AT,
    userId: 'original-account',
  });

  it('만료된 명령은 계정을 몰라도 지울 명령이다', () => {
    // When
    const result = WidgetNavigationPolicy.getCommandState(command, {
      userId: null,
      now: afterCreation(WIDGET_NAVIGATION_COMMAND_TTL_MS),
    });

    // Then
    expect(result).toBe('stale');
  });

  it('살아 있는 명령은 계정을 알 때까지 기다리고 다른 계정이면 지운다', () => {
    // When
    const unknown = WidgetNavigationPolicy.getCommandState(command, {
      userId: null,
      now: CREATED_AT,
    });
    const foreign = WidgetNavigationPolicy.getCommandState(command, {
      userId: 'other-account',
      now: CREATED_AT,
    });
    const valid = WidgetNavigationPolicy.getCommandState(command, {
      userId: 'original-account',
      now: CREATED_AT,
    });

    // Then
    expect(unknown).toBe('ownerUnknown');
    expect(foreign).toBe('foreign');
    expect(valid).toBe('valid');
  });
});

describe('canOpenWithoutOwner', () => {
  it('계정 없는 위젯 클릭은 동작 없는 피드만 연다', () => {
    // Given
    const feed = parseWidgetNavigationUri('aido://feed?date=today');
    const addTodo = parseWidgetNavigationUri('aido://feed?date=today&action=add-todo');

    // When
    const canOpenFeed = feed != null && WidgetNavigationPolicy.canOpenWithoutOwner(feed);
    const canOpenAddTodo = addTodo != null && WidgetNavigationPolicy.canOpenWithoutOwner(addTodo);

    // Then
    expect(addTodo).not.toBeNull();
    expect(canOpenFeed).toBe(true);
    expect(canOpenAddTodo).toBe(false);
  });
});

describe('isSameCommand', () => {
  it('id·주소·계정·만든 시각이 모두 같으면 같은 명령이다', () => {
    // Given
    const stored = createWidgetNavigationCommand();

    // When
    const result = WidgetNavigationPolicy.isSameCommand(stored, createWidgetNavigationCommand());

    // Then
    expect(result).toBe(true);
  });

  it.each([
    { field: 'id', overrides: { id: 'command-2' } },
    { field: '주소', overrides: { uri: 'aido://feed?date=2026-10-05&action=add-todo' } },
    { field: '계정', overrides: { userId: 'user-2' } },
    { field: '만든 시각', overrides: { createdAt: afterCreation(1) } },
  ])('$field만 달라도 다른 명령이라 지우지 않는다', ({ overrides }) => {
    // Given
    const stored = createWidgetNavigationCommand();

    // When
    const result = WidgetNavigationPolicy.isSameCommand(
      stored,
      createWidgetNavigationCommand(overrides),
    );

    // Then
    expect(result).toBe(false);
  });
});
