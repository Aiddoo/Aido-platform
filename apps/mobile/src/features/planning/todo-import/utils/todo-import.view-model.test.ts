import type { OsPermission } from '@src/core/ports/os-permission';
import type { DateFormatContext } from '@src/shared/date/format/date-format';
import { createDateKey } from '@src/testing/date-key';

import { createTodoImportCollection } from '../__tests__/todo-import.fixtures';
import {
  formatImportRange,
  formatUnbreakableLabel,
  getCalendarPermissionView,
  groupCollectionsBySource,
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

describe('groupCollectionsBySource', () => {
  it('출처 계정마다 캘린더를 한 줄로 묶고 일정 수를 더한다', () => {
    // Given
    const personal = createTodoImportCollection({ collectionKey: 'personal', itemCount: 12 });
    const work = createTodoImportCollection({ collectionKey: 'work', title: '업무', itemCount: 7 });
    const family = createTodoImportCollection({
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
    const personal = createTodoImportCollection({
      collectionKey: 'personal',
      title: 'Personal',
      accountName: 'me@gmail.com',
      accountProvider: 'google',
    });
    const work = createTodoImportCollection({
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
    const holidays = createTodoImportCollection({
      collectionKey: 'holidays',
      accountName: 'iCloud',
      accountKind: 'holidays',
      accountProvider: 'subscribed',
    });
    const team = createTodoImportCollection({
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

describe('formatUnbreakableLabel', () => {
  it('빈칸은 줄바꿈 없는 공백으로, 글자 사이는 줄바꿈을 막는 문자로 잇는다', () => {
    // When
    const label = formatUnbreakableLabel('Dec 23');

    // Then
    expect(label.replaceAll(String.fromCodePoint(0x2060), '')).toBe(
      `Dec${String.fromCodePoint(0x00a0)}23`,
    );
    expect(label).not.toContain(' ');
  });
});

describe('formatImportRange', () => {
  const TODAY = createDateKey('2026-11-26');
  const KO_SEOUL: DateFormatContext = { locale: 'ko-KR', timezone: 'Asia/Seoul' };
  const EN_SEOUL: DateFormatContext = { locale: 'en-US', timezone: 'Asia/Seoul' };
  // 영어 기간 구분자는 공용 카탈로그의 en dash다
  const EN_DASH = String.fromCodePoint(0x2013);

  it.each([
    {
      scenario: '올해 안의 기간은 월·일만 잇는다',
      startDate: '2026-11-26',
      endDate: '2026-12-25',
      expected: { ko: '11월 26일~12월 25일', en: `Nov 26${EN_DASH}Dec 25` },
    },
    {
      scenario: '해를 넘는 끝 날에만 해를 붙인다',
      startDate: '2026-11-26',
      endDate: '2027-01-05',
      expected: { ko: '11월 26일~2027년 1월 5일', en: `Nov 26${EN_DASH}Jan 5, 2027` },
    },
    {
      scenario: '하루만 가져오면 그날 하나다',
      startDate: '2026-11-26',
      endDate: '2026-11-26',
      expected: { ko: '11월 26일', en: 'Nov 26' },
    },
  ])('$scenario', ({ startDate, endDate, expected }) => {
    // Given
    const range = { startDate: createDateKey(startDate), endDate: createDateKey(endDate) };

    // When
    const ko = formatImportRange(range, TODAY, KO_SEOUL);
    const en = formatImportRange(range, TODAY, EN_SEOUL);

    // Then
    expect({ ko, en }).toEqual(expected);
  });
});
