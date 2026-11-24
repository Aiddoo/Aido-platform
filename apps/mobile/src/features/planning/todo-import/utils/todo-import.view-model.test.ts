import type { OsPermission } from '@src/core/ports/os-permission';

import { createImportCollection } from '../__tests__/todo-import.fixtures';
import {
  getCalendarPermissionView,
  filterCategoriesByName,
  groupCollectionsByAccount,
  groupCollectionsBySource,
  keepBlockedCalendarPermission,
  toUnbreakableLabel,
} from './todo-import.view-model';

const GRANTED: OsPermission = { status: 'granted', canAskAgain: true };
const UNDETERMINED: OsPermission = { status: 'undetermined', canAskAgain: true };
const DENIED: OsPermission = { status: 'denied', canAskAgain: true };
const BLOCKED: OsPermission = { status: 'denied', canAskAgain: false };

describe('getCalendarPermissionView', () => {
  it.each<[string, OsPermission, OsPermission | null, string]>([
    ['처음 열면 안내 뒤 묻는다', UNDETERMINED, null, 'ask'],
    ['이미 허용했으면 묻는 안내다', GRANTED, null, 'ask'],
    ['방금 거절했으면 다시 물을 수 있어도 다시 조르지 않는다', DENIED, DENIED, 'denied'],
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

describe('groupCollectionsByAccount', () => {
  it('내 계정 캘린더를 계정마다 묶고 받아 보기만 하는 캘린더는 따로 모은다', () => {
    // Given
    const personal = createImportCollection({
      collectionKey: 'personal',
      accountName: 'iCloud',
      accountKind: 'cloud',
      accountProvider: 'icloud',
    });
    const work = createImportCollection({
      collectionKey: 'work',
      accountName: 'iCloud',
      accountKind: 'cloud',
      accountProvider: 'icloud',
    });
    const holidays = createImportCollection({
      collectionKey: 'holidays',
      accountName: 'iCloud',
      accountKind: 'holidays',
      accountProvider: 'subscribed',
    });

    // When
    const { accounts, receivedCollections } = groupCollectionsByAccount([personal, holidays, work]);

    // Then
    expect(accounts).toEqual([
      { accountKey: 'iCloud', account: personal, collections: [personal, work] },
    ]);
    expect(receivedCollections).toEqual([holidays]);
  });

  it('구독·생일 계정은 내 계정 묶음 뒤에 둔다', () => {
    // Given
    const birthdays = createImportCollection({
      collectionKey: 'birthday-calendar',
      accountName: 'A Contacts',
      accountKind: 'other',
      accountProvider: 'birthdays',
    });
    const google = createImportCollection({
      collectionKey: 'google',
      accountName: 'B Google',
      accountKind: 'cloud',
      accountProvider: 'google',
    });

    // When
    const { accounts } = groupCollectionsByAccount([birthdays, google]);

    // Then
    expect(accounts.map(({ accountKey }) => accountKey)).toEqual(['B Google', 'A Contacts']);
  });
});

describe('groupCollectionsBySource', () => {
  it('출처 계정마다 캘린더를 한 줄로 묶고 일정 수를 더한다', () => {
    // Given
    const personal = createImportCollection({ collectionKey: 'personal', itemCount: 12 });
    const work = createImportCollection({ collectionKey: 'work', title: '업무', itemCount: 7 });
    const family = createImportCollection({
      collectionKey: 'family',
      accountName: 'me@gmail.com',
      accountKind: 'cloud',
      accountProvider: 'google',
      title: '가족',
      itemCount: 1,
    });

    // When
    const groups = groupCollectionsBySource([personal, family, work]);

    // Then
    expect(groups).toEqual([
      {
        sourceKey: 'icloud:iCloud',
        provider: 'icloud',
        accountLabel: null,
        collections: [personal, work],
        calendarNames: '개인 · 업무',
        itemCount: 19,
      },
      {
        sourceKey: 'google:me@gmail.com',
        provider: 'google',
        accountLabel: null,
        collections: [family],
        calendarNames: '가족',
        itemCount: 1,
      },
    ]);
  });

  it('같은 서비스 계정이 둘이면 계정 이메일·이름으로 가린다', () => {
    // Given
    const personal = createImportCollection({
      collectionKey: 'personal',
      title: 'Personal',
      accountName: 'me@gmail.com',
      accountProvider: 'google',
    });
    const work = createImportCollection({
      collectionKey: 'work',
      title: 'Personal',
      accountName: '회사',
      accountProvider: 'google',
    });

    // When
    const groups = groupCollectionsBySource([personal, work]);

    // Then
    expect(groups.map(({ accountLabel }) => accountLabel)).toEqual(['me@gmail.com', '회사']);
  });

  it('공휴일·구독 캘린더는 계정이 달라도 종류 하나로 묶는다', () => {
    // Given
    const holidays = createImportCollection({
      collectionKey: 'holidays',
      accountName: 'iCloud',
      accountKind: 'holidays',
      accountProvider: 'subscribed',
    });
    const team = createImportCollection({
      collectionKey: 'team',
      accountName: 'Subscribed Calendars',
      accountKind: 'subscribed',
      accountProvider: 'subscribed',
    });

    // When
    const groups = groupCollectionsBySource([holidays, team]);

    // Then
    expect(groups).toEqual([
      expect.objectContaining({ sourceKey: 'subscribed', collections: [holidays, team] }),
    ]);
  });
});

describe('filterCategoriesByName', () => {
  const categories = [{ name: '할 일' }, { name: 'Work' }, { name: '업무 일지' }];

  it.each([
    ['비어 있으면 모두 남긴다', '  ', ['할 일', 'Work', '업무 일지']],
    ['대소문자를 가리지 않는다', 'work', ['Work']],
    ['이름 가운데 들어 있어도 찾는다', '일', ['할 일', '업무 일지']],
    ['없으면 비어 있다', '공부', []],
  ])('%s', (_case, query, expected) => {
    // When
    const filtered = filterCategoriesByName(categories, query);

    // Then
    expect(filtered.map(({ name }) => name)).toEqual(expected);
  });
});

describe('toUnbreakableLabel', () => {
  it('빈칸은 줄바꿈 없는 공백으로, 글자 사이는 줄바꿈을 막는 문자로 잇는다', () => {
    // When
    const label = toUnbreakableLabel('Dec 23');

    // Then
    expect(label.replaceAll('\u2060', '')).toBe('Dec\u00A023');
    expect(label).not.toContain(' ');
  });
});
