import type { OsPermission } from '@src/core/ports/os-permission';

import { getCalendarPermissionView, keepBlockedCalendarPermission } from './todo-import.view-model';

const GRANTED: OsPermission = { status: 'granted', canAskAgain: true };
const UNDETERMINED: OsPermission = { status: 'undetermined', canAskAgain: true };
const DENIED: OsPermission = { status: 'denied', canAskAgain: true };
const BLOCKED: OsPermission = { status: 'denied', canAskAgain: false };

describe('getCalendarPermissionView', () => {
  it.each<[string, OsPermission, OsPermission | null, string]>([
    ['처음 열면 안내 뒤 묻는다', UNDETERMINED, null, 'ask'],
    ['이미 허용했으면 묻는 안내다', GRANTED, null, 'ask'],
    ['방금 거절했지만 다시 물을 수 있으면 글만 보인다', DENIED, DENIED, 'denied'],
    ['방금 거절해 시스템이 다시 묻지 않으면 설정 열기를 보인다', BLOCKED, BLOCKED, 'blocked'],
    [
      'Android 두 번째 거절은 읽은 값이 묻기 전이어도 설정 열기를 보인다',
      UNDETERMINED,
      BLOCKED,
      'blocked',
    ],
    ['다시 들어왔을 때 다시 물을 수 없으면 설정 열기를 보인다', BLOCKED, null, 'blocked'],
  ])('%s', (_case, permission, answered, expected) => {
    // When
    const view = getCalendarPermissionView(permission, answered);

    // Then
    expect(view).toBe(expected);
  });
});

describe('keepBlockedCalendarPermission', () => {
  it('다시 묻지 않음 답을 받은 뒤 Android가 묻기 전으로 읽어도 다시 묻지 않음을 남긴다', () => {
    // When
    const permission = keepBlockedCalendarPermission(BLOCKED, UNDETERMINED);

    // Then
    expect(permission).toEqual(BLOCKED);
  });

  it('설정에서 허용하고 돌아오면 허용으로 바꾼다', () => {
    // When
    const permission = keepBlockedCalendarPermission(BLOCKED, GRANTED);

    // Then
    expect(permission).toEqual(GRANTED);
  });

  it('다시 물을 수 있던 답은 새로 읽은 값을 따른다', () => {
    // When
    const permission = keepBlockedCalendarPermission(DENIED, UNDETERMINED);

    // Then
    expect(permission).toEqual(UNDETERMINED);
  });
});
